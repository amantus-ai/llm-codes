import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryQueue } from '../retry-queue';
import { PROCESSING_CONFIG } from '@/constants';

// Mock Redis
const mockRedis = {
  zadd: vi.fn(),
  set: vi.fn(),
  zrangebyscore: vi.fn(),
  pipeline: vi.fn(),
  zrem: vi.fn(),
  del: vi.fn(),
  zcard: vi.fn(),
  zcount: vi.fn(),
  zrange: vi.fn(),
  smembers: vi.fn(),
};

describe('RetryQueue', () => {
  let retryQueue: RetryQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    retryQueue = new RetryQueue(mockRedis as unknown as Redis, 'test');
  });

  describe('enqueue', () => {
    it('should add a task to the retry queue', async () => {
      const task = {
        id: 'task-1',
        url: 'https://example.com',
        attempt: 1,
      };

      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      const result = await retryQueue.enqueue(task);

      expect(result).toBe(true);
      expect(mockRedis.zadd).toHaveBeenCalledWith('test:queue', {
        score: expect.any(Number),
        member: 'task-1',
      });
      expect(mockRedis.set).toHaveBeenCalledWith('test:task:task-1', JSON.stringify(task), {
        ex: 24 * 60 * 60,
      });
    });

    it('should calculate exponential backoff with jitter', async () => {
      const task = {
        id: 'task-1',
        url: 'https://example.com',
        attempt: 3,
      };

      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      const now = Date.now();
      await retryQueue.enqueue(task);

      const zaddCall = mockRedis.zadd.mock.calls[0];
      const score = zaddCall[1].score;

      // Calculate expected delay (2^2 * 1000 = 4000ms base delay)
      const expectedBaseDelay = PROCESSING_CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, 2);
      const minScore = now + expectedBaseDelay * 0.75;
      const maxScore = now + expectedBaseDelay * 1.25;

      expect(score).toBeGreaterThanOrEqual(minScore);
      expect(score).toBeLessThanOrEqual(maxScore);
    });

    it('should cap delay at MAX_RETRY_DELAY', async () => {
      const task = {
        id: 'task-1',
        url: 'https://example.com',
        attempt: 10, // High attempt count
      };

      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      const now = Date.now();
      await retryQueue.enqueue(task);

      const zaddCall = mockRedis.zadd.mock.calls[0];
      const score = zaddCall[1].score;

      // Should be capped at MAX_RETRY_DELAY
      const maxScore = now + PROCESSING_CONFIG.MAX_RETRY_DELAY * 1.25;
      expect(score).toBeLessThanOrEqual(maxScore);
    });

    it('should handle Redis errors gracefully', async () => {
      const task = {
        id: 'task-1',
        url: 'https://example.com',
        attempt: 1,
      };

      mockRedis.zadd.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await retryQueue.enqueue(task);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('dequeue', () => {
    it('should retrieve ready tasks', async () => {
      const taskIds = ['task-1', 'task-2'];
      const taskData = [
        JSON.stringify({ id: 'task-1', url: 'https://example.com/1', attempt: 1 }),
        JSON.stringify({ id: 'task-2', url: 'https://example.com/2', attempt: 2 }),
      ];

      mockRedis.zrangebyscore.mockResolvedValue(taskIds);
      mockRedis.pipeline.mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(taskData),
      });
      mockRedis.zrem.mockResolvedValue(2);

      const tasks = await retryQueue.dequeue(10);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[1].id).toBe('task-2');
      expect(mockRedis.zrangebyscore).toHaveBeenCalledWith('test:queue', 0, expect.any(Number), {
        limit: { offset: 0, count: 10 },
      });
      expect(mockRedis.zrem).toHaveBeenCalledWith('test:queue', ...taskIds);
    });

    it('should return empty array when no tasks are ready', async () => {
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const tasks = await retryQueue.dequeue();

      expect(tasks).toEqual([]);
      expect(mockRedis.zrem).not.toHaveBeenCalled();
    });

    it('should handle invalid task data', async () => {
      mockRedis.zrangebyscore.mockResolvedValue(['task-1', 'task-2']);
      mockRedis.pipeline.mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(['invalid-json', JSON.stringify({ id: 'task-2' })]),
      });
      mockRedis.zrem.mockResolvedValue(2);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tasks = await retryQueue.dequeue();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-2');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('remove', () => {
    it('should remove a task from the queue', async () => {
      mockRedis.pipeline.mockReturnValue({
        zrem: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([1, 1]),
      });

      const result = await retryQueue.remove('task-1');

      expect(result).toBe(true);
      const pipeline = mockRedis.pipeline();
      expect(pipeline.zrem).toHaveBeenCalledWith('test:queue', 'task-1');
      expect(pipeline.del).toHaveBeenCalledWith('test:task:task-1');
    });
  });

  describe('size', () => {
    it('should return the queue size', async () => {
      mockRedis.zcard.mockResolvedValue(5);

      const size = await retryQueue.size();

      expect(size).toBe(5);
      expect(mockRedis.zcard).toHaveBeenCalledWith('test:queue');
    });

    it('should return 0 when Redis is not available', async () => {
      const queue = new RetryQueue(null, 'test');
      const size = await queue.size();
      expect(size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const now = Date.now();
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zcount.mockResolvedValue(3);
      mockRedis.zrange.mockResolvedValue(['task-1', now + 5000]);

      const stats = await retryQueue.getStats();

      expect(stats.total).toBe(10);
      expect(stats.ready).toBe(3);
      expect(stats.pending).toBe(7);
      expect(stats.nextRetryIn).toBeGreaterThanOrEqual(4000);
      expect(stats.nextRetryIn).toBeLessThanOrEqual(5000);
    });

    it('should handle empty queue', async () => {
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zcount.mockResolvedValue(0);

      const stats = await retryQueue.getStats();

      expect(stats).toEqual({
        total: 0,
        ready: 0,
        pending: 0,
        nextRetryIn: null,
      });
    });
  });

  describe('clear', () => {
    it('should clear all tasks from the queue', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      mockRedis.zrange.mockResolvedValue(taskIds);
      mockRedis.pipeline.mockReturnValue({
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });

      const result = await retryQueue.clear();

      expect(result).toBe(true);
      expect(mockRedis.zrange).toHaveBeenCalledWith('test:queue', 0, -1);

      const pipeline = mockRedis.pipeline();
      expect(pipeline.del).toHaveBeenCalledWith('test:queue');
      expect(pipeline.del).toHaveBeenCalledTimes(4); // queue + 3 tasks
    });
  });

  describe('processReady', () => {
    it('should process ready tasks', async () => {
      const tasks = [
        { id: 'task-1', url: 'https://example.com/1', attempt: 1 },
        { id: 'task-2', url: 'https://example.com/2', attempt: 1 },
      ];

      mockRedis.zrangebyscore.mockResolvedValue(['task-1', 'task-2']);
      mockRedis.pipeline.mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(tasks.map((t) => JSON.stringify(t))),
      });
      mockRedis.zrem.mockResolvedValue(2);

      const callback = vi.fn().mockResolvedValue(true);
      const result = await retryQueue.processReady(callback);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should re-queue failed tasks', async () => {
      const task = { id: 'task-1', url: 'https://example.com', attempt: 1 };

      mockRedis.zrangebyscore.mockResolvedValue(['task-1']);
      mockRedis.pipeline.mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([JSON.stringify(task)]),
      });
      mockRedis.zrem.mockResolvedValue(1);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      const callback = vi.fn().mockResolvedValue(false);
      const result = await retryQueue.processReady(callback);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('should skip tasks that exceeded max attempts', async () => {
      const task = { id: 'task-1', url: 'https://example.com', attempt: 6 };

      mockRedis.zrangebyscore.mockResolvedValue(['task-1']);
      mockRedis.pipeline.mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([JSON.stringify(task)]),
      });
      mockRedis.zrem.mockResolvedValue(1);

      const callback = vi.fn();
      const result = await retryQueue.processReady(callback, { maxAttempts: 5 });

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getFailedTasks', () => {
    it('should retrieve failed tasks', async () => {
      const failedIds = ['task-1', 'task-2'];
      const taskData = [
        JSON.stringify({ id: 'task-1', url: 'https://example.com/1', attempt: 6 }),
        JSON.stringify({ id: 'task-2', url: 'https://example.com/2', attempt: 7 }),
      ];

      mockRedis.smembers.mockResolvedValue(failedIds);
      mockRedis.pipeline.mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(taskData),
      });

      const tasks = await retryQueue.getFailedTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].attempt).toBe(6);
      expect(tasks[1].attempt).toBe(7);
    });

    it('should return empty array when no failed tasks', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const tasks = await retryQueue.getFailedTasks();

      expect(tasks).toEqual([]);
    });
  });
});

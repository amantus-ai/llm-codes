import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerPool, getUrlPriority, PRIORITY_LEVELS } from '../worker-pool';

describe('WorkerPool', () => {
  let processingFn: ReturnType<typeof vi.fn>;
  let onTaskComplete: ReturnType<typeof vi.fn>;
  let onTaskError: ReturnType<typeof vi.fn>;
  let onQueueEmpty: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    processingFn = vi.fn();
    onTaskComplete = vi.fn();
    onTaskError = vi.fn();
    onQueueEmpty = vi.fn();
  });

  describe('basic functionality', () => {
    it('should process items with correct concurrency', async () => {
      let activeCount = 0;
      let maxActiveCount = 0;

      processingFn.mockImplementation(async (item: number) => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);

        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 50));

        activeCount--;
        return item * 2;
      });

      const pool = new WorkerPool(processingFn, {
        concurrency: 3,
        onTaskComplete,
      });

      // Add 10 items
      for (let i = 0; i < 10; i++) {
        pool.add(i);
      }

      pool.start();
      await pool.waitForCompletion();

      expect(processingFn).toHaveBeenCalledTimes(10);
      expect(maxActiveCount).toBeLessThanOrEqual(3);
      expect(onTaskComplete).toHaveBeenCalledTimes(10);
    });

    it('should process items immediately when slots available', async () => {
      const results: number[] = [];

      processingFn.mockImplementation(async (item: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(item);
        return item;
      });

      const pool = new WorkerPool(processingFn, {
        concurrency: 5,
      });

      pool.start();

      // Add items one by one with delays
      pool.add(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      pool.add(2);
      await new Promise((resolve) => setTimeout(resolve, 20));
      pool.add(3);

      await pool.waitForCompletion();

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('priority handling', () => {
    it('should process high priority items first', async () => {
      const processOrder: number[] = [];

      processingFn.mockImplementation(async (item: { id: number }) => {
        processOrder.push(item.id);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item.id;
      });

      const pool = new WorkerPool(processingFn, {
        concurrency: 1, // Process one at a time to check order
      });

      // Add items with different priorities
      pool.add({ id: 1 }, 0); // Low priority
      pool.add({ id: 2 }, 10); // High priority
      pool.add({ id: 3 }, 5); // Medium priority
      pool.add({ id: 4 }, 10); // High priority

      pool.start();
      await pool.waitForCompletion();

      // Should process in priority order: [2, 4] (high), 3 (medium), 1 (low)
      expect(processOrder).toEqual([2, 4, 3, 1]);
    });
  });

  describe('error handling', () => {
    it('should handle processing errors gracefully', async () => {
      processingFn.mockImplementation(async (item: number) => {
        if (item === 5) {
          throw new Error('Processing error');
        }
        return item * 2;
      });

      const pool = new WorkerPool(processingFn, {
        concurrency: 2,
        onTaskComplete,
        onTaskError,
      });

      for (let i = 0; i < 10; i++) {
        pool.add(i);
      }

      pool.start();
      await pool.waitForCompletion();

      expect(onTaskComplete).toHaveBeenCalledTimes(9);
      expect(onTaskError).toHaveBeenCalledTimes(1);
      expect(onTaskError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('queue management', () => {
    it('should clear queue when requested', () => {
      const pool = new WorkerPool(processingFn, { concurrency: 1 });

      for (let i = 0; i < 10; i++) {
        pool.add(i);
      }

      expect(pool.getStatus().queueLength).toBe(10);

      pool.clearQueue();

      expect(pool.getStatus().queueLength).toBe(0);
    });

    it('should emit drain event when queue empties', async () => {
      processingFn.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const pool = new WorkerPool(processingFn, {
        concurrency: 2,
        onQueueEmpty,
      });

      const drainListener = vi.fn();
      pool.on('drain', drainListener);

      pool.add(1);
      pool.add(2);

      pool.start();
      await pool.waitForCompletion();

      expect(onQueueEmpty).toHaveBeenCalledTimes(1);
      expect(drainListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop functionality', () => {
    it('should stop processing gracefully', async () => {
      let processedCount = 0;

      processingFn.mockImplementation(async () => {
        processedCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const pool = new WorkerPool(processingFn, {
        concurrency: 2,
      });

      for (let i = 0; i < 20; i++) {
        pool.add(i);
      }

      pool.start();

      // Let some processing happen
      await new Promise((resolve) => setTimeout(resolve, 100));

      await pool.stop();

      const countAfterStop = processedCount;

      // Wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No more items should have been processed
      expect(processedCount).toBe(countAfterStop);
      expect(processedCount).toBeGreaterThan(0);
      expect(processedCount).toBeLessThan(20);
    });
  });
});

describe('getUrlPriority', () => {
  it('should assign highest priority to root pages', () => {
    expect(getUrlPriority('https://example.com/')).toBe(PRIORITY_LEVELS.ROOT);
    expect(getUrlPriority('https://example.com/index')).toBe(PRIORITY_LEVELS.ROOT);
    expect(getUrlPriority('https://example.com/docs/')).toBe(PRIORITY_LEVELS.ROOT);
  });

  it('should assign main priority to documentation and overview pages', () => {
    expect(getUrlPriority('https://example.com/docs/getting-started')).toBe(PRIORITY_LEVELS.MAIN);
    expect(getUrlPriority('https://example.com/quickstart')).toBe(PRIORITY_LEVELS.MAIN);
    expect(getUrlPriority('https://example.com/overview')).toBe(PRIORITY_LEVELS.MAIN);
  });

  it('should assign section priority to moderate depth pages', () => {
    expect(getUrlPriority('https://example.com/docs/api')).toBe(PRIORITY_LEVELS.SECTION);
    expect(getUrlPriority('https://example.com/guide/basics')).toBe(PRIORITY_LEVELS.SECTION);
  });

  it('should assign subsection priority to deep pages', () => {
    expect(getUrlPriority('https://example.com/docs/api/v2/methods/users/create')).toBe(
      PRIORITY_LEVELS.SUBSECTION
    );
    expect(getUrlPriority('https://example.com/a/b/c/d/e/f')).toBe(PRIORITY_LEVELS.SUBSECTION);
  });

  it('should assign default priority to other pages', () => {
    expect(getUrlPriority('https://example.com/docs/api/methods')).toBe(PRIORITY_LEVELS.DEFAULT);
  });
});

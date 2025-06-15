import { Redis } from '@upstash/redis';
import { PROCESSING_CONFIG } from '@/constants';
import { logError } from './errors';

interface RetryTask {
  id: string;
  url: string;
  attempt: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export class RetryQueue {
  private redis: Redis | null;
  private keyPrefix: string;

  constructor(redis: Redis | null, keyPrefix = 'retry') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Add a task to the retry queue with a calculated score
   * Score is based on: current time + exponential backoff delay
   */
  async enqueue(task: RetryTask): Promise<boolean> {
    if (!this.redis) {
      console.warn('Redis not available, retry queue disabled');
      return false;
    }

    try {
      // Calculate backoff delay with jitter
      const baseDelay = Math.min(
        PROCESSING_CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, task.attempt - 1),
        PROCESSING_CONFIG.MAX_RETRY_DELAY
      );

      // Add jitter (±25% of base delay)
      const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
      const delay = Math.max(0, baseDelay + jitter);

      // Score is the timestamp when the task should be retried
      const score = Date.now() + delay;

      // Store task data
      const taskData = JSON.stringify(task);

      // Add to sorted set
      await this.redis.zadd(`${this.keyPrefix}:queue`, {
        score,
        member: task.id,
      });

      // Store task details
      await this.redis.set(
        `${this.keyPrefix}:task:${task.id}`,
        taskData,
        { ex: 24 * 60 * 60 } // Expire after 24 hours
      );

      console.warn(`Task ${task.id} queued for retry at score ${score} (delay: ${delay}ms)`);
      return true;
    } catch (error) {
      logError(new Error(`Failed to enqueue retry task: ${error}`), { task });
      return false;
    }
  }

  /**
   * Get tasks that are ready to be retried
   */
  async dequeue(limit = 10): Promise<RetryTask[]> {
    if (!this.redis) {
      return [];
    }

    try {
      const now = Date.now();

      // Get tasks with score <= now (ready to retry)
      const taskIds = await this.redis.zrange(`${this.keyPrefix}:queue`, 0, now, {
        byScore: true,
        offset: 0,
        count: limit,
      });

      if (!taskIds || taskIds.length === 0) {
        return [];
      }

      // Get task details
      const pipeline = this.redis.pipeline();
      for (const taskId of taskIds) {
        pipeline.get(`${this.keyPrefix}:task:${taskId}`);
      }

      const results = await pipeline.exec();
      const tasks: RetryTask[] = [];

      for (let i = 0; i < results.length; i++) {
        const taskData = results[i];
        if (taskData) {
          try {
            const task = JSON.parse(taskData as string);
            tasks.push(task);
          } catch (e) {
            console.error(`Failed to parse task data: ${e}`);
          }
        }
      }

      // Remove processed tasks from queue
      if (tasks.length > 0) {
        await this.redis.zrem(`${this.keyPrefix}:queue`, ...taskIds);
      }

      return tasks;
    } catch (error) {
      logError(new Error(`Failed to dequeue retry tasks: ${error}`));
      return [];
    }
  }

  /**
   * Remove a task from the retry queue
   */
  async remove(taskId: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zrem(`${this.keyPrefix}:queue`, taskId);
      pipeline.del(`${this.keyPrefix}:task:${taskId}`);
      await pipeline.exec();
      return true;
    } catch (error) {
      logError(new Error(`Failed to remove retry task: ${error}`), { taskId });
      return false;
    }
  }

  /**
   * Get the current queue size
   */
  async size(): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      return await this.redis.zcard(`${this.keyPrefix}:queue`);
    } catch (error) {
      logError(new Error(`Failed to get queue size: ${error}`));
      return 0;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    ready: number;
    pending: number;
    nextRetryIn: number | null;
  }> {
    if (!this.redis) {
      return { total: 0, ready: 0, pending: 0, nextRetryIn: null };
    }

    try {
      const now = Date.now();

      // Get total queue size
      const total = await this.redis.zcard(`${this.keyPrefix}:queue`);

      // Get ready tasks (score <= now)
      const ready = await this.redis.zcount(`${this.keyPrefix}:queue`, 0, now);

      // Get pending tasks
      const pending = total - ready;

      // Get next retry time
      let nextRetryIn: number | null = null;
      if (pending > 0) {
        const nextTask = await this.redis.zrange(`${this.keyPrefix}:queue`, 0, 0, {
          withScores: true,
        });

        if (nextTask && nextTask.length === 2) {
          const nextScore = nextTask[1] as number;
          nextRetryIn = Math.max(0, nextScore - now);
        }
      }

      return { total, ready, pending, nextRetryIn };
    } catch (error) {
      logError(new Error(`Failed to get queue stats: ${error}`));
      return { total: 0, ready: 0, pending: 0, nextRetryIn: null };
    }
  }

  /**
   * Clear all tasks from the queue
   */
  async clear(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      // Get all task IDs
      const taskIds = await this.redis.zrange(`${this.keyPrefix}:queue`, 0, -1);

      if (taskIds && taskIds.length > 0) {
        const pipeline = this.redis.pipeline();

        // Delete the queue
        pipeline.del(`${this.keyPrefix}:queue`);

        // Delete all task data
        for (const taskId of taskIds) {
          pipeline.del(`${this.keyPrefix}:task:${taskId}`);
        }

        await pipeline.exec();
      }

      return true;
    } catch (error) {
      logError(new Error(`Failed to clear retry queue: ${error}`));
      return false;
    }
  }

  /**
   * Process ready tasks with a callback
   */
  async processReady(
    callback: (task: RetryTask) => Promise<boolean>,
    options: {
      batchSize?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<{ processed: number; failed: number }> {
    const { batchSize = 10, maxAttempts = PROCESSING_CONFIG.MAX_RETRIES } = options;

    let processed = 0;
    let failed = 0;

    try {
      const tasks = await this.dequeue(batchSize);

      for (const task of tasks) {
        try {
          // Check if max attempts reached
          if (task.attempt >= maxAttempts) {
            console.warn(`Task ${task.id} exceeded max attempts (${maxAttempts})`);
            failed++;
            continue;
          }

          // Process the task
          const success = await callback(task);

          if (success) {
            processed++;
          } else {
            // Re-queue for retry
            await this.enqueue({
              ...task,
              attempt: task.attempt + 1,
            });
            failed++;
          }
        } catch (error) {
          logError(new Error(`Failed to process retry task: ${error}`), { task });

          // Re-queue for retry
          await this.enqueue({
            ...task,
            attempt: task.attempt + 1,
            lastError: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }
    } catch (error) {
      logError(new Error(`Failed to process ready tasks: ${error}`));
    }

    return { processed, failed };
  }

  /**
   * Get failed tasks (tasks that exceeded max attempts)
   */
  async getFailedTasks(limit = 100): Promise<RetryTask[]> {
    if (!this.redis) {
      return [];
    }

    try {
      // Store failed tasks in a separate set
      const failedIds = await this.redis.smembers(`${this.keyPrefix}:failed`);

      if (!failedIds || failedIds.length === 0) {
        return [];
      }

      const tasks: RetryTask[] = [];
      const pipeline = this.redis.pipeline();

      for (const taskId of failedIds.slice(0, limit)) {
        pipeline.get(`${this.keyPrefix}:task:${taskId}`);
      }

      const results = await pipeline.exec();

      for (const taskData of results) {
        if (taskData) {
          try {
            const task = JSON.parse(taskData as string);
            tasks.push(task);
          } catch (e) {
            console.error(`Failed to parse failed task data: ${e}`);
          }
        }
      }

      return tasks;
    } catch (error) {
      logError(new Error(`Failed to get failed tasks: ${error}`));
      return [];
    }
  }
}

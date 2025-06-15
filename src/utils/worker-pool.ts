import { EventEmitter } from 'events';

export interface WorkerPoolOptions<T = unknown, E = unknown> {
  concurrency: number;
  onTaskComplete?: (result: T) => void;
  onTaskError?: (error: E) => void;
  onQueueEmpty?: () => void;
}

export interface QueueItem<T> {
  data: T;
  priority?: number;
}

export class WorkerPool<T, R> extends EventEmitter {
  private queue: QueueItem<T>[] = [];
  private activeWorkers = 0;
  private isRunning = false;
  private processingFunction: (item: T) => Promise<R>;
  private options: WorkerPoolOptions<R, unknown>;
  private processedCount = 0;
  private errorCount = 0;

  constructor(processingFunction: (item: T) => Promise<R>, options: WorkerPoolOptions<R, unknown>) {
    super();
    this.processingFunction = processingFunction;
    this.options = options;
  }

  /**
   * Add an item to the queue with optional priority
   * Higher priority items are processed first
   */
  add(item: T, priority = 0): void {
    this.queue.push({ data: item, priority });
    // Sort by priority (higher first)
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (this.isRunning) {
      this.processNext();
    }
  }

  /**
   * Add multiple items to the queue
   */
  addBatch(items: T[], priority = 0): void {
    items.forEach((item) => this.add(item, priority));
  }

  /**
   * Start processing the queue
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('start');

    // Start initial workers up to concurrency limit
    const initialWorkers = Math.min(this.options.concurrency, this.queue.length);
    for (let i = 0; i < initialWorkers; i++) {
      this.processNext();
    }
  }

  /**
   * Stop processing (gracefully waits for active workers)
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit('stop');

    // Wait for all active workers to complete
    while (this.activeWorkers > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Process the next item in the queue if a worker is available
   */
  private async processNext(): Promise<void> {
    // Check if we can start a new worker
    if (
      !this.isRunning ||
      this.activeWorkers >= this.options.concurrency ||
      this.queue.length === 0
    ) {
      // Check if we're done
      if (this.activeWorkers === 0 && this.queue.length === 0) {
        this.emit('drain');
        this.options.onQueueEmpty?.();
      }
      return;
    }

    // Get next item from queue
    const queueItem = this.queue.shift();
    if (!queueItem) return;

    this.activeWorkers++;
    this.emit('workerStart', {
      activeWorkers: this.activeWorkers,
      queueLength: this.queue.length,
    });

    try {
      const result = await this.processingFunction(queueItem.data);
      this.processedCount++;

      this.emit('taskComplete', result);
      this.options.onTaskComplete?.(result);
    } catch (error) {
      this.errorCount++;

      this.emit('taskError', error);
      this.options.onTaskError?.(error);
    } finally {
      this.activeWorkers--;
      this.emit('workerEnd', {
        activeWorkers: this.activeWorkers,
        queueLength: this.queue.length,
      });

      // Immediately try to process next item
      this.processNext();
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      isRunning: this.isRunning,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
    this.emit('queueCleared');
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      if (this.activeWorkers === 0 && this.queue.length === 0) {
        resolve();
        return;
      }

      const checkCompletion = () => {
        if (this.activeWorkers === 0 && this.queue.length === 0) {
          this.removeListener('workerEnd', checkCompletion);
          resolve();
        }
      };

      this.on('workerEnd', checkCompletion);
    });
  }
}

// Priority levels for different types of URLs
export const PRIORITY_LEVELS = {
  ROOT: 10, // Root/index pages
  MAIN: 5, // Main documentation pages
  SECTION: 3, // Section pages
  SUBSECTION: 1, // Deep subsection pages
  DEFAULT: 0, // Default priority
};

/**
 * Determine priority based on URL characteristics
 */
export function getUrlPriority(url: string): number {
  const urlPath = new URL(url).pathname.toLowerCase();
  const segments = urlPath.split('/').filter((p) => p);
  const depth = segments.length;

  // Root or index pages get highest priority
  if (urlPath === '/' || urlPath.endsWith('/index') || (urlPath.endsWith('/') && depth === 0)) {
    return PRIORITY_LEVELS.ROOT;
  }

  // Getting started, quickstart, overview pages always get MAIN priority
  if (
    urlPath.includes('getting-started') ||
    urlPath.includes('quickstart') ||
    urlPath.includes('overview')
  ) {
    return PRIORITY_LEVELS.MAIN;
  }

  // Docs root should be ROOT priority
  if (urlPath === '/docs/' || urlPath === '/docs') {
    return PRIORITY_LEVELS.ROOT;
  }

  // Section pages (moderate depth: 2 segments like /docs/api or /guide/basics)
  if (depth === 2) {
    return PRIORITY_LEVELS.SECTION;
  }

  // Deep pages get lower priority (more than 5 segments)
  if (depth > 5) {
    return PRIORITY_LEVELS.SUBSECTION;
  }

  // Medium depth pages (3-5 segments) get default priority
  if (depth >= 3 && depth <= 5) {
    return PRIORITY_LEVELS.DEFAULT;
  }

  return PRIORITY_LEVELS.DEFAULT;
}

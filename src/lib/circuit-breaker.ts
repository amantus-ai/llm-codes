import { Redis } from '@upstash/redis';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes before closing
  timeout: number; // Time in ms before attempting to close
  halfOpenRequests: number; // Max requests in half-open state
}

export interface CircuitBreakerState {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  halfOpenRequests: number;
}

export class CircuitBreaker {
  private redis: Redis | null;
  private config: CircuitBreakerConfig;
  private key: string;

  constructor(redis: Redis | null, name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.redis = redis;
    this.key = `circuit:${name}`;
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000, // 1 minute
      halfOpenRequests: config.halfOpenRequests || 3,
    };
  }

  private async getState(): Promise<CircuitBreakerState> {
    if (!this.redis) {
      // Fallback to always closed when Redis is not available
      return {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: 'closed',
        halfOpenRequests: 0,
      };
    }

    try {
      const state = await this.redis.get<CircuitBreakerState>(this.key);
      return (
        state || {
          failures: 0,
          successes: 0,
          lastFailureTime: 0,
          state: 'closed',
          halfOpenRequests: 0,
        }
      );
    } catch (error) {
      console.error('Failed to get circuit breaker state:', error);
      return {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: 'closed',
        halfOpenRequests: 0,
      };
    }
  }

  private async setState(state: CircuitBreakerState): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(this.key, state, {
        ex: 3600, // Expire after 1 hour
      });
    } catch (error) {
      console.error('Failed to set circuit breaker state:', error);
    }
  }

  async canRequest(): Promise<boolean> {
    const state = await this.getState();

    switch (state.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if timeout has passed
        if (Date.now() - state.lastFailureTime >= this.config.timeout) {
          // Transition to half-open
          await this.setState({
            ...state,
            state: 'half-open',
            halfOpenRequests: 0,
          });
          return true;
        }
        return false;

      case 'half-open':
        // Allow limited requests in half-open state
        if (state.halfOpenRequests < this.config.halfOpenRequests) {
          await this.setState({
            ...state,
            halfOpenRequests: state.halfOpenRequests + 1,
          });
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  async recordSuccess(): Promise<void> {
    const state = await this.getState();

    switch (state.state) {
      case 'half-open':
        const newSuccesses = state.successes + 1;
        if (newSuccesses >= this.config.successThreshold) {
          // Close the circuit
          await this.setState({
            failures: 0,
            successes: 0,
            lastFailureTime: 0,
            state: 'closed',
            halfOpenRequests: 0,
          });
        } else {
          await this.setState({
            ...state,
            successes: newSuccesses,
          });
        }
        break;

      case 'open':
        // Shouldn't happen, but reset to closed
        await this.setState({
          failures: 0,
          successes: 0,
          lastFailureTime: 0,
          state: 'closed',
          halfOpenRequests: 0,
        });
        break;

      // For closed state, we don't need to track successes
    }
  }

  async recordFailure(): Promise<void> {
    const state = await this.getState();
    const now = Date.now();

    switch (state.state) {
      case 'closed':
        const newFailures = state.failures + 1;
        if (newFailures >= this.config.failureThreshold) {
          // Open the circuit
          await this.setState({
            ...state,
            failures: newFailures,
            lastFailureTime: now,
            state: 'open',
          });
        } else {
          await this.setState({
            ...state,
            failures: newFailures,
            lastFailureTime: now,
          });
        }
        break;

      case 'half-open':
        // Failure in half-open state immediately opens the circuit
        await this.setState({
          ...state,
          failures: state.failures + 1,
          lastFailureTime: now,
          state: 'open',
          halfOpenRequests: 0,
        });
        break;

      // For open state, just update the last failure time
      case 'open':
        await this.setState({
          ...state,
          lastFailureTime: now,
        });
        break;
    }
  }

  async getStatus(): Promise<{
    state: string;
    canRequest: boolean;
    stats: CircuitBreakerState;
  }> {
    const state = await this.getState();
    const canRequest = await this.canRequest();

    return {
      state: state.state,
      canRequest,
      stats: state,
    };
  }

  async reset(): Promise<void> {
    await this.setState({
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      state: 'closed',
      halfOpenRequests: 0,
    });
  }
}

// Export singleton instance for Firecrawl API
export const firecrawlCircuitBreaker = new CircuitBreaker(
  null, // Will be initialized with Redis instance
  'firecrawl',
  {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    halfOpenRequests: 3,
  }
);

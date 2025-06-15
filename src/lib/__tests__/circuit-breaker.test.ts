import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  pipeline: vi.fn(),
  ttl: vi.fn(),
};

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    circuitBreaker = new CircuitBreaker(mockRedis as any, 'test-service');
  });

  describe('canRequest', () => {
    it('should allow requests when circuit is closed', async () => {
      mockRedis.get.mockResolvedValue(null); // No state means closed

      const result = await circuitBreaker.canRequest();
      expect(result).toBe(true);
    });

    it('should block requests when circuit is open', async () => {
      mockRedis.get.mockResolvedValue({
        state: 'open',
        failures: 5,
        successes: 0,
        lastFailureTime: Date.now() - 1000, // Recent failure
        halfOpenRequests: 0,
      });

      const result = await circuitBreaker.canRequest();
      expect(result).toBe(false);
    });

    it('should allow test request in half-open state', async () => {
      mockRedis.get.mockResolvedValue({
        state: 'half-open',
        failures: 5,
        successes: 0,
        lastFailureTime: Date.now(),
        halfOpenRequests: 0, // Less than limit
      });

      const result = await circuitBreaker.canRequest();
      expect(result).toBe(true);
    });

    it('should transition to half-open when cooldown expires', async () => {
      // First call returns open state with old failure time
      mockRedis.get.mockResolvedValue({
        state: 'open',
        failures: 5,
        successes: 0,
        lastFailureTime: Date.now() - 70000, // More than 60s ago
        halfOpenRequests: 0,
      });

      const result = await circuitBreaker.canRequest();
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalled(); // Should update state to half-open
    });
  });

  describe('recordSuccess', () => {
    it('should not change state when circuit is closed', async () => {
      mockRedis.get.mockResolvedValue(null); // Closed state

      await circuitBreaker.recordSuccess();

      // In closed state, success doesn't change anything
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should close circuit after threshold successes in half-open state', async () => {
      // Return state with 1 success in half-open (will become 2 after this call)
      mockRedis.get.mockResolvedValue({
        state: 'half-open',
        failures: 0,
        successes: 1,
        lastFailureTime: 0,
        halfOpenRequests: 1,
      });

      await circuitBreaker.recordSuccess();

      // Should set state to closed after reaching threshold
      expect(mockRedis.set).toHaveBeenCalledWith(
        'circuit:test-service',
        expect.objectContaining({ state: 'closed' }),
        expect.any(Object)
      );
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', async () => {
      mockRedis.get.mockResolvedValue({
        state: 'closed',
        failures: 1,
        successes: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
      });

      await circuitBreaker.recordFailure();

      // Should update state with incremented failure count
      expect(mockRedis.set).toHaveBeenCalledWith(
        'circuit:test-service',
        expect.objectContaining({ failures: 2 }),
        expect.any(Object)
      );
    });

    it('should open circuit after threshold failures', async () => {
      // Return state with 4 failures (will become 5 - the threshold)
      mockRedis.get.mockResolvedValue({
        state: 'closed',
        failures: 4,
        successes: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
      });

      await circuitBreaker.recordFailure();

      // Should open the circuit after reaching threshold
      expect(mockRedis.set).toHaveBeenCalledWith(
        'circuit:test-service',
        expect.objectContaining({ state: 'open', failures: 5 }),
        expect.any(Object)
      );
    });

    it('should immediately open circuit in half-open state', async () => {
      // Return half-open state
      mockRedis.get.mockResolvedValue({
        state: 'half-open',
        failures: 0,
        successes: 1,
        lastFailureTime: 0,
        halfOpenRequests: 1,
      });

      await circuitBreaker.recordFailure();

      // Should immediately open the circuit
      expect(mockRedis.set).toHaveBeenCalledWith(
        'circuit:test-service',
        expect.objectContaining({ state: 'open' }),
        expect.any(Object)
      );
    });
  });

  describe('getStatus', () => {
    it('should return current circuit state', async () => {
      mockRedis.get.mockResolvedValue({
        state: 'open',
        failures: 3,
        successes: 1,
        lastFailureTime: Date.now(),
        halfOpenRequests: 0,
      });

      const status = await circuitBreaker.getStatus();

      expect(status.state).toBe('open');
      expect(status.stats.failures).toBe(3);
      expect(status.stats.successes).toBe(1);
    });

    it('should handle missing state gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);

      const status = await circuitBreaker.getStatus();

      expect(status.state).toBe('closed');
      expect(status.stats.failures).toBe(0);
      expect(status.stats.successes).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset circuit to closed state', async () => {
      await circuitBreaker.reset();

      // Should set state to closed with zero counts
      expect(mockRedis.set).toHaveBeenCalledWith(
        'circuit:test-service',
        expect.objectContaining({
          state: 'closed',
          failures: 0,
          successes: 0,
          lastFailureTime: 0,
          halfOpenRequests: 0,
        }),
        expect.any(Object)
      );
    });
  });
});

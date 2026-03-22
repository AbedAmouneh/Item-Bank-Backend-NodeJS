import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CircuitBreaker, CircuitState } from '../../utils/circuit-breaker';

const { mockNow } = vi.hoisted(() => ({
  mockNow: vi.fn(),
}));

vi.mock('../../utils/runtime', () => ({
  runtime: { now: mockNow },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const BASE_TIME = new Date('2026-01-01T00:00:00.000Z');

function makeBreaker() {
  return new CircuitBreaker({
    serviceName: 'test-service',
    failureThreshold: 3,
    resetTimeout: 5000,
    successThreshold: 2,
    requestTimeout: 100,
  });
}

async function tripBreaker(breaker: CircuitBreaker): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await expect(
      breaker.execute(async () => { throw new Error('fail'); })
    ).rejects.toThrow('fail');
  }
}

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNow.mockReturnValue(new Date(BASE_TIME));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- CLOSED state ---

  describe('execute — CLOSED state', () => {
    test('passes through and returns the function result', async () => {
      const breaker = makeBreaker();

      const result = await breaker.execute(async () => 'hello');

      expect(result).toBe('hello');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    test('stays CLOSED after failures below the threshold', async () => {
      const breaker = makeBreaker();

      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => { throw new Error('fail'); })
        ).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failureCount).toBe(2);
    });

    test('trips to OPEN when failure threshold is reached', async () => {
      const breaker = makeBreaker();

      await tripBreaker(breaker);

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    test('resets failure count to 0 after a successful call', async () => {
      const breaker = makeBreaker();

      await expect(
        breaker.execute(async () => { throw new Error('fail'); })
      ).rejects.toThrow();
      expect(breaker.getStats().failureCount).toBe(1);

      await breaker.execute(async () => 'ok');
      expect(breaker.getStats().failureCount).toBe(0);
    });
  });

  // --- OPEN state ---

  describe('execute — OPEN state', () => {
    test('blocks requests and sets circuitBreakerOpen on the error', async () => {
      const breaker = makeBreaker();
      await tripBreaker(breaker);

      const err = await breaker.execute(async () => 'ok').catch(e => e);

      expect((err as any).circuitBreakerOpen).toBe(true);
      expect(err.message).toContain('OPEN');
    });

    test('transitions to HALF_OPEN and allows a call when reset timeout elapses', async () => {
      const breaker = makeBreaker();
      await tripBreaker(breaker);

      mockNow.mockReturnValue(new Date(BASE_TIME.getTime() + 6000));

      const result = await breaker.execute(async () => 'recovered');

      expect(result).toBe('recovered');
      expect(breaker.getState()).not.toBe(CircuitState.OPEN);
    });
  });

  // --- HALF_OPEN state ---

  describe('execute — HALF_OPEN state', () => {
    async function getHalfOpenBreaker(): Promise<CircuitBreaker> {
      const breaker = makeBreaker();
      await tripBreaker(breaker);
      mockNow.mockReturnValue(new Date(BASE_TIME.getTime() + 6000));
      return breaker;
    }

    test('trips back to OPEN immediately on any failure', async () => {
      const breaker = await getHalfOpenBreaker();

      // First call transitions OPEN → HALF_OPEN, then the function throws
      await expect(
        breaker.execute(async () => { throw new Error('half-open fail'); })
      ).rejects.toThrow('half-open fail');

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    test('stays HALF_OPEN until the success threshold is reached', async () => {
      const breaker = await getHalfOpenBreaker();

      // First success: transitions OPEN → HALF_OPEN, successCount becomes 1 (threshold = 2)
      await breaker.execute(async () => 'ok1');
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(breaker.getStats().successCount).toBe(1);
    });

    test('closes circuit once success threshold is reached', async () => {
      const breaker = await getHalfOpenBreaker();

      await breaker.execute(async () => 'ok1'); // successCount = 1
      await breaker.execute(async () => 'ok2'); // successCount = 2 → CLOSED

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().successCount).toBe(0); // reset on close
      expect(breaker.getStats().nextAttemptTime).toBeNull();
    });
  });

  // --- request timeout ---

  describe('execute — request timeout', () => {
    test('rejects when the wrapped function exceeds requestTimeout', async () => {
      vi.useFakeTimers();
      mockNow.mockReturnValue(new Date(BASE_TIME));
      const breaker = makeBreaker(); // requestTimeout = 100ms

      const promise = breaker.execute(
        () => new Promise(resolve => setTimeout(() => resolve('late'), 500))
      );
      // Attach a handler immediately so the rejection is not "unhandled"
      // when the 100ms timer fires inside advanceTimersByTimeAsync.
      promise.catch(() => {});

      // Advance 200ms: fires the 100ms circuit-breaker timeout, rejects the promise.
      await vi.advanceTimersByTimeAsync(200);
      await expect(promise).rejects.toThrow('Request timeout after 100ms');

      // Advance past the 500ms slow-function timer so it fires cleanly
      // (calling resolve on an already-rejected promise is a no-op).
      await vi.advanceTimersByTimeAsync(400);
      vi.useRealTimers();
    });
  });

  // --- getState ---

  describe('getState', () => {
    test('returns CLOSED initially', () => {
      const breaker = makeBreaker();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  // --- getStats ---

  describe('getStats', () => {
    test('returns all stat fields with correct values after activity', async () => {
      const breaker = makeBreaker();

      await breaker.execute(async () => 'ok');
      await expect(
        breaker.execute(async () => { throw new Error('fail'); })
      ).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(1);
      expect(stats.successCount).toBe(0);
      expect(stats.lastFailureTime).not.toBeNull();
      expect(stats.nextAttemptTime).toBeNull();
    });

    test('nextAttemptTime is set after circuit trips', async () => {
      const breaker = makeBreaker();
      await tripBreaker(breaker);

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.nextAttemptTime).not.toBeNull();
    });
  });

  // --- reset ---

  describe('reset', () => {
    test('returns to CLOSED and clears all counters from OPEN state', async () => {
      const breaker = makeBreaker();
      await tripBreaker(breaker);
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.lastFailureTime).toBeNull();
      expect(stats.nextAttemptTime).toBeNull();
    });

    test('allows requests again after a manual reset from OPEN', async () => {
      const breaker = makeBreaker();
      await tripBreaker(breaker);

      breaker.reset();

      const result = await breaker.execute(async () => 'back online');
      expect(result).toBe('back online');
    });
  });
});

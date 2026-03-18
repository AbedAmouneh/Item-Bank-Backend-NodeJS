import { createChildLogger } from './logger';
import { runtime } from './runtime';

const logger = createChildLogger('circuit-breaker');

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation, requests allowed
  OPEN = 'OPEN', // Circuit tripped, requests blocked
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  /** Name of the service for logging */
  serviceName: string;
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms to wait before attempting recovery (OPEN -> HALF_OPEN) */
  resetTimeout?: number;
  /** Number of successful requests needed to close circuit from HALF_OPEN */
  successThreshold?: number;
  /** Timeout for individual requests in ms */
  requestTimeout?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private nextAttemptTime: Date | null = null;

  private readonly serviceName: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly requestTimeout: number;

  constructor(options: CircuitBreakerOptions) {
    this.serviceName = options.serviceName;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000; // 1 minute default
    this.successThreshold = options.successThreshold ?? 2;
    this.requestTimeout = options.requestTimeout ?? 30000; // 30 seconds default

    logger.info(
      {
        serviceName: this.serviceName,
        failureThreshold: this.failureThreshold,
        resetTimeout: this.resetTimeout,
        successThreshold: this.successThreshold,
      },
      'Circuit breaker initialized'
    );
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (
        this.nextAttemptTime &&
        runtime.now().getTime() >= this.nextAttemptTime.getTime()
      ) {
        logger.info(
          { serviceName: this.serviceName },
          'Circuit breaker transitioning to HALF_OPEN'
        );
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        const error = new Error(`Circuit breaker OPEN for ${this.serviceName}`);
        (error as any).circuitBreakerOpen = true;
        logger.warn(
          {
            serviceName: this.serviceName,
            nextAttempt: this.nextAttemptTime?.toISOString(),
          },
          'Circuit breaker preventing request'
        );
        throw error;
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Request timeout after ${this.requestTimeout}ms for ${this.serviceName}`
          )
        );
      }, this.requestTimeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        logger.info(
          { serviceName: this.serviceName },
          'Circuit breaker closing after successful recovery'
        );
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = runtime.now();

    logger.warn(
      {
        serviceName: this.serviceName,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        state: this.state,
        error: error instanceof Error ? error.message : error,
      },
      'Circuit breaker recorded failure'
    );

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.tripCircuit();
    }
  }

  /**
   * Trip the circuit breaker (CLOSED/HALF_OPEN -> OPEN)
   */
  private tripCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(
      runtime.now().getTime() + this.resetTimeout
    );

    logger.error(
      {
        serviceName: this.serviceName,
        failureCount: this.failureCount,
        nextAttempt: this.nextAttemptTime.toISOString(),
      },
      'Circuit breaker OPENED - blocking requests'
    );
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: string | null;
    nextAttemptTime: string | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime?.toISOString() || null,
      nextAttemptTime: this.nextAttemptTime?.toISOString() || null,
    };
  }

  /**
   * Manually reset the circuit breaker (use with caution)
   */
  reset(): void {
    logger.info(
      { serviceName: this.serviceName },
      'Circuit breaker manually reset'
    );
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}

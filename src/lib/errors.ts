/**
 * Custom error classes for better error handling and monitoring
 */

export class BaseError extends Error {
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class NetworkError extends BaseError {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(message: string, statusCode?: number, url?: string, context?: Record<string, any>) {
    super(message, { ...context, statusCode, url });
    this.statusCode = statusCode;
    this.url = url;
  }
}

export class FirecrawlError extends NetworkError {
  public readonly apiError?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    statusCode?: number,
    url?: string,
    apiError?: string,
    retryable = false,
    context?: Record<string, any>
  ) {
    super(message, statusCode, url, { ...context, apiError, retryable });
    this.apiError = apiError;
    this.retryable = retryable;
  }
}

export class CacheError extends BaseError {
  public readonly operation: 'get' | 'set' | 'delete' | 'lock';

  constructor(
    message: string,
    operation: 'get' | 'set' | 'delete' | 'lock',
    context?: Record<string, any>
  ) {
    super(message, { ...context, operation });
    this.operation = operation;
  }
}

export class ValidationError extends BaseError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any, context?: Record<string, any>) {
    super(message, { ...context, field, value });
    this.field = field;
    this.value = value;
  }
}

export class CircuitBreakerError extends BaseError {
  public readonly state: 'open' | 'half-open';
  public readonly cooldownRemaining?: number;

  constructor(
    message: string,
    state: 'open' | 'half-open',
    cooldownRemaining?: number,
    context?: Record<string, any>
  ) {
    super(message, { ...context, state, cooldownRemaining });
    this.state = state;
    this.cooldownRemaining = cooldownRemaining;
  }
}

export class ContentError extends BaseError {
  public readonly contentLength: number;
  public readonly truncated: boolean;

  constructor(
    message: string,
    contentLength: number,
    truncated = false,
    context?: Record<string, any>
  ) {
    super(message, { ...context, contentLength, truncated });
    this.contentLength = contentLength;
    this.truncated = truncated;
  }
}

// Error type guards
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isFirecrawlError(error: unknown): error is FirecrawlError {
  return error instanceof FirecrawlError;
}

export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isCircuitBreakerError(error: unknown): error is CircuitBreakerError {
  return error instanceof CircuitBreakerError;
}

export function isContentError(error: unknown): error is ContentError {
  return error instanceof ContentError;
}

// Error logging utility
export function logError(error: Error, additionalContext?: Record<string, any>) {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...additionalContext,
  };

  if (error instanceof BaseError) {
    Object.assign(errorData, error.toJSON());
  }

  // In production, this would send to an error monitoring service
  console.error('Error occurred:', errorData);
}

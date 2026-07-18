import { inject } from '@angular/core';
import { PiiMaskPipe } from '../../shared/pipes/pii-mask.pipe';

/**
 * Centralized error handling utility for consistent error processing across all services.
 * 
 * Provides a standardized try-catch wrapper that:
 * - Logs sanitized diagnostic metrics (PII-masked)
 * - Returns typed error responses
 * - Prevents silent failures
 * 
 * @example
 * ```typescript
 * const result = await this.errorHandler.execute(
 *   () => this.firestore.collection('users').get(),
 *   'fetchUsers',
 *   { userId: '123' }
 * );
 * 
 * if (result.isFailure()) {
 *   // Handle error
 *   return result.error;
 * }
 * 
 * // Use result.data
 * ```
 */
export class ErrorHandler {
  private readonly piiMaskPipe = inject(PiiMaskPipe);

  /**
   * Executes an async operation with centralized error handling.
   * 
   * @template T - The expected return type of the operation
   * @param operation - The async function to execute
   * @param operationName - Name of the operation for logging context
   * @param context - Additional context data for debugging (will be PII-masked)
   * @returns A Result object containing either the data or error
   * 
   * @remarks
   * All errors are logged with sanitized context. Never log raw PII.
   * Consumer-facing errors are generic and do not expose system details.
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ): Promise<Result<T>> {
    try {
      const data = await operation();
      return Result.success(data);
    } catch (error) {
      return this.handleError(error, operationName, context);
    }
  }

  /**
   * Executes a synchronous operation with centralized error handling.
   * 
   * @template T - The expected return type of the operation
   * @param operation - The synchronous function to execute
   * @param operationName - Name of the operation for logging context
   * @param context - Additional context data for debugging (will be PII-masked)
   * @returns A Result object containing either the data or error
   */
  executeSync<T>(
    operation: () => T,
    operationName: string,
    context?: Record<string, unknown>
  ): Result<T> {
    try {
      const data = operation();
      return Result.success(data);
    } catch (error) {
      return this.handleError(error, operationName, context);
    }
  }

  /**
   * Handles and logs errors with PII masking.
   * 
   * @param error - The caught error
   * @param operationName - Name of the failed operation
   * @param context - Context data to log (will be PII-masked)
   * @returns A failure Result with sanitized error message
   * @private
   */
  private handleError<T>(
    error: unknown,
    operationName: string,
    context?: Record<string, unknown>
  ): Result<T> {
    // Extract error details safely
    const errorMessage = this.extractErrorMessage(error);
    const errorCode = this.extractErrorCode(error);

    // Sanitize context for logging (mask PII)
    const sanitizedContext = this.sanitizeContext(context);

    // Log with sanitized data (never log raw PII)
    console.error(
      `[${operationName}] Operation failed`,
      {
        code: errorCode,
        message: errorMessage,
        context: sanitizedContext,
        timestamp: new Date().toISOString(),
      }
    );

    // Return consumer-friendly error (no system details)
    const consumerMessage = this.getConsumerFriendlyMessage(errorCode);
    return Result.failure<T>(consumerMessage);
  }

  /**
   * Extracts a safe error message from various error types.
   * 
   * @param error - The error object
   * @returns A sanitized error message string
   * @private
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown error occurred';
  }

  /**
   * Extracts an error code from various error types.
   * 
   * @param error - The error object
   * @returns An error code string or 'UNKNOWN'
   * @private
   */
  private extractErrorCode(error: unknown): string {
    if (error && typeof error === 'object') {
      if ('code' in error) {
        return String((error as { code: unknown }).code);
      }
      if ('name' in error) {
        return String((error as { name: unknown }).name);
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Sanitizes context object by masking all string values.
   * 
   * @param context - The context object to sanitize
   * @returns A new object with all string values PII-masked
   * @private
   */
  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> {
    if (!context) {
      return {};
    }

    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        sanitized[key] = this.piiMaskPipe.transform(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects (one level deep)
        sanitized[key] = this.sanitizeNestedObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitizes a nested object by masking string values.
   * 
   * @param obj - The nested object to sanitize
   * @returns A new object with string values masked
   * @private
   */
  private sanitizeNestedObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.piiMaskPipe.transform(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Maps error codes to consumer-friendly messages.
   * 
   * @param errorCode - The error code from the caught error
   * @returns A user-friendly error message
   * @private
   */
  private getConsumerFriendlyMessage(errorCode: string): string {
    const errorMap: Record<string, string> = {
      'auth/user-not-found': 'Invalid email or password.',
      'auth/wrong-password': 'Invalid email or password.',
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'permission-denied': 'You do not have permission to perform this action.',
      'not-found': 'The requested resource was not found.',
      'already-exists': 'This record already exists.',
      'resource-exhausted': 'Service is temporarily unavailable. Please try again later.',
      'unavailable': 'Service is temporarily unavailable. Please try again.',
    };

    return errorMap[errorCode] || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Represents the result of an operation that may fail.
 * 
 * @template T - The type of data on success
 */
export class Result<T> {
  private constructor(
    private readonly success: boolean,
    private readonly data: T | null,
    private readonly error: string | null
  ) {}

  /**
   * Creates a successful Result.
   * 
   * @param data - The successful operation data
   * @returns A Result instance with success=true
   */
  static success<T>(data: T): Result<T> {
    return new Result<T>(true, data, null);
  }

  /**
   * Creates a failed Result.
   * 
   * @param error - The error message
   * @returns A Result instance with success=false
   */
  static failure<T>(error: string): Result<T> {
    return new Result<T>(false, null, error);
  }

  /**
   * Checks if the result is successful.
   * 
   * @returns true if the operation succeeded
   */
  isSuccess(): boolean {
    return this.success;
  }

  /**
   * Checks if the result is a failure.
   * 
   * @returns true if the operation failed
   */
  isFailure(): boolean {
    return !this.success;
  }

  /**
   * Gets the data from a successful result.
   * 
   * @throws Error if the result is a failure
   * @returns The operation data
   */
  getData(): T {
    if (this.isFailure()) {
      throw new Error('Cannot get data from a failed result. Use isSuccess() to check first.');
    }
    return this.data as T;
  }

  /**
   * Gets the error from a failed result.
   * 
   * @throws Error if the result is successful
   * @returns The error message
   */
  getError(): string {
    if (this.isSuccess()) {
      throw new Error('Cannot get error from a successful result. Use isFailure() to check first.');
    }
    return this.error as string;
  }
}
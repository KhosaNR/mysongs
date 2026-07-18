import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorHandler } from '../utils/error-handler';
import { PiiMaskPipe } from '../../shared/pipes/pii-mask.pipe';

/**
 * HTTP interceptor that catches and handles HTTP errors globally.
 * 
 * Transforms technical error responses into consumer-friendly messages.
 * Logs sanitized error details for debugging while preventing PII exposure.
 * 
 * @example
 * // Automatically applied to all HTTP requests
 * // No manual configuration needed
 * 
 * // In components, handle errors via service Result types
 * this.http.get('/api/data').subscribe({
 *   next: (data) => console.log(data),
 *   error: (err) => console.error('Request failed')
 * });
 */
export function ErrorInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const errorHandler = inject(ErrorHandler);
  const piiMaskPipe = inject(PiiMaskPipe);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      return handleError(error, request, errorHandler, piiMaskPipe);
    })
  );
}

/**
 * Handles HTTP errors and transforms them into consumer-friendly responses.
 * 
 * @param error - The HTTP error response
 * @param request - The original request
 * @param errorHandler - The error handler service
 * @param piiMaskPipe - The PII mask pipe
 * @returns An Observable that emits the error event
 */
function handleError(
  error: HttpErrorResponse,
  request: HttpRequest<unknown>,
  errorHandler: ErrorHandler,
  piiMaskPipe: PiiMaskPipe
): Observable<HttpEvent<unknown>> {
  // Extract error details
  const errorCode = extractErrorCode(error);
  const errorMessage = extractErrorMessage(error);
  const status = error.status;

  // Sanitize request data for logging (mask PII)
  const sanitizedRequest = sanitizeRequest(request, piiMaskPipe);

  // Log the error with sanitized data
  errorHandler.executeSync(
    () => {
      throw new Error(`HTTP ${status}: ${errorMessage}`);
    },
    'httpError',
    {
      status,
      errorCode,
      url: piiMaskPipe.transform(request.url),
      method: request.method,
      requestBody: sanitizedRequest,
    }
  );

  // Transform to consumer-friendly error
  const consumerMessage = getConsumerFriendlyMessage(status, errorCode);

  // Create a new error response with the consumer-friendly message
  const consumerError = new HttpErrorResponse({
    error: {
      message: consumerMessage,
      code: errorCode,
      status: status,
    },
    status: status,
    statusText: error.statusText,
    url: request.url,
  });

  return throwError(() => consumerError);
}

/**
 * Extracts an error code from the HTTP error response.
 * 
 * @param error - The HTTP error response
 * @returns An error code string
 */
function extractErrorCode(error: HttpErrorResponse): string {
  if (error.error && typeof error.error === 'object' && 'code' in error.error) {
    return String(error.error.code);
  }
  
  // Map HTTP status codes to error codes
  const statusCodeMap: Record<number, string> = {
    400: 'bad-request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not-found',
    409: 'conflict',
    422: 'validation-error',
    429: 'rate-limit-exceeded',
    500: 'server-error',
    502: 'bad-gateway',
    503: 'service-unavailable',
    504: 'gateway-timeout',
  };

  return statusCodeMap[error.status] || 'unknown-error';
}

/**
 * Extracts an error message from the HTTP error response.
 * 
 * @param error - The HTTP error response
 * @returns An error message string
 */
function extractErrorMessage(error: HttpErrorResponse): string {
  if (typeof error.error === 'string') {
    return error.error;
  }
  
  if (error.error && typeof error.error === 'object' && 'message' in error.error) {
    return String(error.error.message);
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/**
 * Sanitizes the HTTP request for logging by masking PII in the body.
 * 
 * @param request - The HTTP request
 * @param piiMaskPipe - The PII mask pipe
 * @returns A sanitized representation of the request
 */
function sanitizeRequest(request: HttpRequest<unknown>, piiMaskPipe: PiiMaskPipe): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    method: request.method,
    url: piiMaskPipe.transform(request.url),
  };

  // Sanitize request body if present
  const body = request['body'];
  if (body) {
    if (typeof body === 'string') {
      sanitized['body'] = piiMaskPipe.transform(body);
    } else if (typeof body === 'object' && body !== null) {
      sanitized['body'] = sanitizeObject(body as Record<string, unknown>, piiMaskPipe);
    } else {
      sanitized['body'] = '[non-string body]';
    }
  }

  return sanitized;
}

/**
 * Sanitizes an object by masking all string values.
 * 
 * @param obj - The object to sanitize
 * @param piiMaskPipe - The PII mask pipe
 * @returns A new object with string values masked
 */
function sanitizeObject(obj: Record<string, unknown>, piiMaskPipe: PiiMaskPipe): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = piiMaskPipe.transform(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? piiMaskPipe.transform(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, piiMaskPipe);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Maps HTTP status codes and error codes to consumer-friendly messages.
 * 
 * @param status - The HTTP status code
 * @param errorCode - The error code
 * @returns A user-friendly error message
 */
function getConsumerFriendlyMessage(status: number, errorCode: string): string {
  // Status-based messages
  const statusMessages: Record<number, string> = {
    400: 'Invalid request. Please check your input and try again.',
    401: 'You are not authorized to perform this action. Please log in.',
    403: 'You do not have permission to access this resource.',
    404: 'The requested resource was not found.',
    409: 'A conflict occurred. Please refresh and try again.',
    422: 'Please correct the errors and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Server error. Please try again later.',
    502: 'Service temporarily unavailable. Please try again.',
    503: 'Service temporarily unavailable. Please try again later.',
    504: 'Request timed out. Please try again.',
  };

  // Error code-based overrides
  const errorCodeMessages: Record<string, string> = {
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
    'rate-limit-exceeded': 'Too many requests. Please wait a moment and try again.',
  };

  // Return error code message if available, otherwise status message
  return errorCodeMessages[errorCode] || statusMessages[status] || 'An unexpected error occurred. Please try again.';
}
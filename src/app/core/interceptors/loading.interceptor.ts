import { inject, signal } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

/**
 * HTTP interceptor that manages global loading states for HTTP requests.
 * 
 * Tracks active requests and provides a signal-based loading indicator.
 * Useful for showing spinners or skeleton loaders during network operations.
 * 
 * @example
 * // Automatically applied to all HTTP requests
 * // No manual configuration needed
 * 
 * // In components, listen to the loading signal
 * this.loadingInterceptor.isLoading.subscribe(isLoading => {
 *   console.log('Loading:', isLoading);
 * });
 */
export function LoadingInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  let activeRequests = 0;
  const isLoadingSignal = signal<boolean>(false);

  // Increment active request count
  activeRequests++;
  isLoadingSignal.set(true);

  return next(request).pipe(
    finalize(() => {
      // Decrement active request count
      activeRequests--;
      
      // Update loading state based on remaining requests
      if (activeRequests === 0) {
        isLoadingSignal.set(false);
      }
    })
  );
}

/**
 * Service providing global loading state management.
 */
export class LoadingStateService {
  private activeRequests = 0;
  private readonly isLoadingSignal = signal<boolean>(false);

  /**
   * Signal indicating whether any HTTP request is currently in progress.
   * Use this to show/hide global loading indicators.
   */
  readonly isLoading = this.isLoadingSignal.asReadonly();

  /**
   * Increments the active request count and sets loading to true.
   */
  increment(): void {
    this.activeRequests++;
    this.isLoadingSignal.set(true);
  }

  /**
   * Decrements the active request count and sets loading to false if no more requests.
   */
  decrement(): void {
    this.activeRequests--;
    if (this.activeRequests === 0) {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Gets the current loading state synchronously.
   * 
   * @returns true if any HTTP request is in progress
   */
  getIsLoading(): boolean {
    return this.isLoadingSignal();
  }

  /**
   * Manually sets the loading state.
   * Useful for non-HTTP operations that should show a loading indicator.
   * 
   * @param isLoading - Whether loading is active
   */
  setLoading(isLoading: boolean): void {
    this.isLoadingSignal.set(isLoading);
  }

  /**
   * Forces the loading state to false.
   * Useful for error recovery scenarios.
   */
  clearLoading(): void {
    this.activeRequests = 0;
    this.isLoadingSignal.set(false);
  }
}

/**
 * Global network connectivity status service.
 *
 * Tracks online/offline state using `navigator.onLine` and browser
 * `online`/`offline` events. Exposes reactive Signals for
 * network-aware components and services.
 *
 * @example
 * ```typescript
 * const network = inject(NetworkStatusService);
 * effect(() => {
 *   if (network.isOnline()) {
 *     console.log('Back online!');
 *   }
 * });
 * ```
 */
import { Injectable, signal, DestroyRef, inject, effect } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NetworkStatusService {
  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================

  /**
   * Whether the browser currently has network connectivity.
   * Initialized synchronously from `navigator.onLine`.
   */
  readonly isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  /**
   * Tracks whether the user was previously offline and has just reconnected.
   * Auto-resets to `false` after the next detection cycle to allow
   * one-shot reconnection handlers (e.g. auto-retry, toast notifications).
   */
  readonly wasOffline = signal(false);

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  constructor() {
    // Guard against SSR environments where `window` is undefined
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', this.#handleOnline);
    window.addEventListener('offline', this.#handleOffline);

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      window.removeEventListener('online', this.#handleOnline);
      window.removeEventListener('offline', this.#handleOffline);
    });

    // Auto-reset wasOffline after it has been consumed
    effect(() => {
      if (this.wasOffline()) {
        // Allow one tick for consumers to react, then reset
        setTimeout(() => this.wasOffline.set(false), 0);
      }
    });
  }

  // ==========================================================================
  // PRIVATE EVENT HANDLERS
  // ==========================================================================

  #handleOnline = () => {
    if (!this.isOnline()) {
      this.wasOffline.set(true);
    }
    this.isOnline.set(true);
  };

  #handleOffline = () => {
    this.isOnline.set(false);
  };
}
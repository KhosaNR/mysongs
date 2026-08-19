/**
 * Global network connectivity status service.
 *
 * Tracks online/offline state exclusively from *confirmed* signals:
 * - Browser `online`/`offline` events while the app is running.
 * - `reportNetworkFailure()` / `reportNetworkSuccess()` calls from the
 *   central error pipeline (`ErrorHandler`, `ErrorInterceptor`) and the
 *   audio player when a network-level operation actually fails or recovers.
 *
 * The service starts optimistically `online`. The raw `navigator.onLine`
 * value is intentionally NOT snapshotted at boot: browsers frequently report
 * `false` during early page load (before connectivity is established) even
 * though the site loads fine, which previously caused the offline banner to
 * appear while the website was still loading. Offline UI now only reacts once
 * loading has actually failed due to a network issue.
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
   * Whether connectivity is currently considered available.
   *
   * Starts `true` and only flips to `false` on a confirmed offline signal:
   * a browser `offline` event or a reported network failure from the central
   * error pipeline / audio player.
   */
  readonly isOnline = signal<boolean>(true);

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
  // PUBLIC REPORTING API
  // ==========================================================================

  /**
   * Reports a confirmed network-level failure (e.g. a Firestore read rejected
   * with `unavailable`, an HTTP request failing with status 0, or an audio
   * `MEDIA_ERR_NETWORK`).
   *
   * Flips `isOnline` to `false` so offline-aware UI (the global network
   * banner) reacts to actual failures rather than the unreliable boot-time
   * `navigator.onLine` snapshot.
   */
  reportNetworkFailure(): void {
    this.isOnline.set(false);
  }

  /**
   * Reports a successful network operation after connectivity was lost.
   *
   * Flips `isOnline` back to `true` and triggers the one-shot `wasOffline`
   * reconnection flow (banner hide, "Back online!" toast, auto-retries).
   * No-op while already online.
   */
  reportNetworkSuccess(): void {
    if (!this.isOnline()) {
      this.wasOffline.set(true);
    }
    this.isOnline.set(true);
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
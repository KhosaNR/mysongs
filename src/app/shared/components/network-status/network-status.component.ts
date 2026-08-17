/**
 * Global network status indicator component.
 *
 * Displays a dismissible offline banner at the top of the viewport when
 * the user loses connectivity. Automatically shows a success toast when
 * connectivity is restored.
 *
 * Designed to be placed in the root app shell (`app.html`) for global
 * coverage.
 *
 * ### Usage:
 * ```html
 * <app-network-status />
 * ```
 */
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  effect,
  DestroyRef,
} from '@angular/core';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-network-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showBanner()) {
      <div
        class="network-status"
        role="alert"
        aria-live="assertive"
      >
        <div class="network-status__body">
          <svg
            class="network-status__icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <p class="network-status__text">
            You are offline. Some features may be unavailable.
          </p>
        </div>
        <button
          class="network-status__dismiss"
          (click)="dismiss()"
          aria-label="Dismiss offline notice"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .network-status {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: var(--z-toast);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--color-warning);
        color: var(--text-on-warning);
        font-family: var(--font-family-primary);
        font-size: var(--text-sm);
        animation: network-status-slide-in var(--transition-base) ease-out;
      }

      .network-status__body {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex: 1;
        min-width: 0;
      }

      .network-status__icon {
        flex-shrink: 0;
        opacity: 0.9;
      }

      .network-status__text {
        margin: 0;
        line-height: var(--leading-normal);
        font-weight: var(--weight-medium);
      }

      .network-status__dismiss {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--touch-target-min, 44px);
        height: var(--touch-target-min, 44px);
        border: none;
        border-radius: var(--radius-md);
        background: transparent;
        color: inherit;
        cursor: pointer;
        transition: background var(--transition-fast);
        -webkit-tap-highlight-color: transparent;
      }

      .network-status__dismiss:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .network-status__dismiss:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      @keyframes network-status-slide-in {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class NetworkStatusComponent {
  // ==========================================================================
  // STATE
  // ==========================================================================

  /**
   * Whether the offline banner is currently visible.
   * Starts false, becomes true when offline, dismissable by user.
   */
  readonly showBanner = signal(false);

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  private readonly networkStatus = inject<NetworkStatusService>(NetworkStatusService);
  private readonly toastService = inject<ToastService>(ToastService);

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      if (this.networkStatus.isOnline()) {
        this.showBanner.set(false);
      } else {
        this.showBanner.set(true);
      }
    });

    // Show "Back online!" toast when connectivity is restored
    effect(() => {
      if (this.networkStatus.wasOffline()) {
        this.toastService.success('Back online!');
      }
    });

    destroyRef.onDestroy(() => {
      // Cleanup handled by service
    });
  }

  // ==========================================================================
  // PUBLIC
  // ==========================================================================

  /**
   * Dismisses the offline banner. The user has acknowledged the offline state.
   */
  dismiss(): void {
    this.showBanner.set(false);
  }
}
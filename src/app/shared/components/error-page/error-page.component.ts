/**
 * Error boundary page component for displaying route/application errors.
 *
 * Provides a status code display, descriptive message, and recovery actions
 * including an auto-redirect countdown timer and manual navigation options.
 *
 * @example
 * ```html
 * <!-- Basic error page -->
 * <app-error-page statusCode="500" />
 *
 * <!-- Custom error with redirect -->
 * <app-error-page
 *   statusCode="403"
 *   title="Access Denied"
 *   message="You don't have permission to view this page."
 *   redirectRoute="/home"
 * />
 * ```
 */

import { Component, input, signal, effect, inject, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { NetworkStatusService } from '../../../core/services/network-status.service';

/**
 * Error boundary page for unexpected route/application errors.
 *
 * Features:
 * - Prominent status code display with semantic icon
 * - Configurable title, message, and redirect route
 * - 30-second auto-redirect countdown timer
 * - Network-aware auto-retry: when the error was caused by network loss,
 *   the page immediately retries navigation upon reconnection
 * - "Go Home" and "Try Again" action buttons
 * - Accessible with proper ARIA roles and live regions
 */
@Component({
  selector: 'app-error-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error-page" role="alert">
      <div class="error-page__container">
        <!-- Status Code -->
        <span class="error-page__status" aria-hidden="true">{{ statusCode() }}</span>

        <!-- Error Icon -->
        <span class="error-page__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </span>

        <!-- Title -->
        <h1 class="error-page__title">{{ title() }}</h1>

        <!-- Message -->
        <p class="error-page__message">{{ message() }}</p>

        <!-- Auto-redirect countdown -->
        @if (redirectRoute(); as route) {
          <p class="error-page__countdown" aria-live="polite">
            Redirecting to {{ route }} in
            <span class="error-page__timer">{{ countdown() }}</span>s
          </p>
        }

        <!-- Actions -->
        <div class="error-page__actions">
          <button type="button" class="error-page__btn error-page__btn--primary" (click)="goHome()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Go Home
          </button>
          <button type="button" class="error-page__btn error-page__btn--secondary" (click)="tryAgain()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Try Again
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .error-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: var(--space-8);
    }

    .error-page__container {
      text-align: center;
      max-width: 420px;
      animation: error-fade-in var(--transition-base) var(--ease-out);
    }

    @keyframes error-fade-in {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .error-page__status {
      display: block;
      font-size: 6rem;
      font-weight: 800;
      line-height: 1;
      color: color-mix(in srgb, var(--color-error) 20%, var(--text-primary));
      margin-bottom: var(--space-2);
      letter-spacing: -0.05em;
    }

    .error-page__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      color: var(--color-error);
      margin-bottom: var(--space-4);
    }

    .error-page__icon svg {
      width: 100%;
      height: 100%;
    }

    .error-page__title {
      font-size: var(--text-2xl);
      font-weight: var(--weight-normal);
      color: var(--text-heading);
      margin: 0 0 var(--space-3);
      line-height: var(--leading-tight);
    }

    .error-page__message {
      font-size: var(--text-base);
      color: var(--text-secondary);
      margin: 0 0 var(--space-6);
      line-height: var(--leading-relaxed);
    }

    .error-page__countdown {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      margin: 0 0 var(--space-6);
    }

    .error-page__timer {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--color-error);
    }

    .error-page__actions {
      display: flex;
      gap: var(--space-3);
      justify-content: center;
      flex-wrap: wrap;
    }

    .error-page__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      border: none;
      line-height: var(--leading-normal);
    }

    .error-page__btn svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .error-page__btn--primary {
      background: var(--accent-primary);
      color: var(--text-on-primary);
    }

    .error-page__btn--primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .error-page__btn--secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .error-page__btn--secondary:hover {
      background: var(--color-hover);
      transform: translateY(-1px);
    }
  `],
})
export class ErrorPageComponent {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly networkStatus = inject(NetworkStatusService);

  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * HTTP status code to display prominently.
   * @default 500
   */
  readonly statusCode = input<number>(500);

  /**
   * Error title text.
   * @default 'Something went wrong'
   */
  readonly title = input<string>('Something went wrong');

  /**
   * Descriptive error message.
   * @default 'An unexpected error occurred. Please try again.'
   */
  readonly message = input<string>('An unexpected error occurred. Please try again.');

  /**
   * Route path to redirect to after the countdown completes.
   * If not provided, no auto-redirect occurs.
   * @default '/'
   */
  readonly redirectRoute = input<string>('/');

  // ==========================================================================
  // INTERNAL STATE
  // ==========================================================================

  /**
   * Countdown value in seconds for auto-redirect timer.
   * Starts at 30 and counts down to 0.
   */
  protected readonly countdown = signal<number>(30);

  // ==========================================================================
  // AUTO-REDIRECT TIMER
  // ==========================================================================

  constructor() {
    effect(() => {
      const route = this.redirectRoute();
      if (route) {
        this.countdown.set(30);
        const intervalId = setInterval(() => {
          this.countdown.update((c) => {
            const next = c - 1;
            if (next <= 0) {
              clearInterval(intervalId);
              this.router.navigate([route]);
            }
            return next;
          });
        }, 1000);

        this.destroyRef.onDestroy(() => {
          clearInterval(intervalId);
        });
      }
    });

    // Network-aware auto-retry: when the user comes back online,
    // immediately retry navigation instead of waiting for the countdown
    effect(() => {
      if (this.networkStatus.wasOffline()) {
        const route = this.redirectRoute();
        if (route) {
          this.router.navigate([route]);
        }
      }
    });
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Navigate to the home route.
   */
  protected goHome(): void {
    this.router.navigate(['/']);
  }

  /**
   * Reload the current page to retry.
   */
  protected tryAgain(): void {
    window.location.reload();
  }
}
/**
 * Error banner component for displaying contextual alert messages.
 *
 * Provides four visual variants (error, warning, success, info) with
 * matching icons, dismissible option, and optional auto-dismiss timer.
 *
 * @example
 * ```html
 * <!-- Basic error banner -->
 * <app-error-banner message="Failed to load tracks. Please try again." />
 *
 * <!-- Success banner with auto-dismiss -->
 * <app-error-banner
 *   message="Track purchased successfully!"
 *   type="success"
 *   [autoDismiss]="5000"
 *   (dismiss)="onDismissed()"
 * />
 *
 * <!-- Non-dismissible warning banner -->
 * <app-error-banner
 *   message="Your session is about to expire"
 *   type="warning"
 *   [dismissible]="false"
 * />
 * ```
 */

import { Component, input, output, ChangeDetectionStrategy, signal, effect, inject, DestroyRef } from '@angular/core';

export type BannerType = 'error' | 'warning' | 'success' | 'info';

/**
 * Error banner component for dismissible contextual alert messages.
 *
 * Features:
 * - Four visual variants with semantic color coding (error/warning/success/info)
 * - Inline SVG icons per variant
 * - Optional dismissible close button
 * - Optional auto-dismiss with configurable timeout
 * - Entrance slide-in animation
 * - WCAG accessible with proper roles and aria labels
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="banner"
      [class.banner--error]="type() === 'error'"
      [class.banner--warning]="type() === 'warning'"
      [class.banner--success]="type() === 'success'"
      [class.banner--info]="type() === 'info'"
      [class.banner--dismissed]="isDismissed()"
      [attr.role]="type() === 'error' || type() === 'warning' ? 'alert' : 'status'"
      [attr.aria-live]="'polite'"
    >
      <div class="banner__content">
        <!-- Icon -->
        <span class="banner__icon" aria-hidden="true">
          @if (type() === 'error') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          } @else if (type() === 'warning') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          } @else if (type() === 'success') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          } @else if (type() === 'info') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          }
        </span>

        <!-- Message -->
        <span class="banner__message">{{ message() }}</span>
      </div>

      <!-- Dismiss Button -->
      @if (dismissible()) {
        <button
          type="button"
          class="banner__dismiss"
          (click)="onDismiss()"
          aria-label="Dismiss alert"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .banner {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      border-left: 4px solid;
      animation: banner-slide-in var(--transition-base) var(--ease-out);
      transition: opacity var(--transition-fast), transform var(--transition-fast);
    }

    .banner--dismissed {
      opacity: 0;
      transform: translateX(-100%);
      pointer-events: none;
      position: absolute;
    }

    @keyframes banner-slide-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ========================================================================
       VARIANT STYLES
       ======================================================================== */

    .banner--error {
      background: color-mix(in srgb, var(--color-error) 10%, var(--bg-secondary));
      border-left-color: var(--color-error);
      color: var(--color-error);
    }

    .banner--warning {
      background: color-mix(in srgb, var(--color-warning) 10%, var(--bg-secondary));
      border-left-color: var(--color-warning);
      color: var(--color-warning);
    }

    .banner--success {
      background: color-mix(in srgb, var(--color-success) 10%, var(--bg-secondary));
      border-left-color: var(--color-success);
      color: var(--color-success);
    }

    .banner--info {
      background: color-mix(in srgb, var(--color-info) 10%, var(--bg-secondary));
      border-left-color: var(--color-info);
      color: var(--color-info);
    }

    /* ========================================================================
       CONTENT
       ======================================================================== */

    .banner__content {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      flex: 1;
      min-width: 0;
    }

    .banner__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .banner__icon svg {
      width: 100%;
      height: 100%;
    }

    .banner__message {
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      color: var(--text-primary);
      flex: 1;
      min-width: 0;
      word-wrap: break-word;
    }

    /* ========================================================================
       DISMISS BUTTON
       ======================================================================== */

    .banner__dismiss {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-tertiary);
      transition: all var(--transition-fast);
      margin-top: -2px;
      margin-right: -4px;
    }

    .banner__dismiss:hover {
      background: var(--color-hover);
      color: var(--text-primary);
    }

    .banner__dismiss svg {
      width: 16px;
      height: 16px;
    }

    .banner--error .banner__dismiss:hover {
      background: color-mix(in srgb, var(--color-error) 20%, transparent);
      color: var(--color-error);
    }

    .banner--warning .banner__dismiss:hover {
      background: color-mix(in srgb, var(--color-warning) 20%, transparent);
      color: var(--color-warning);
    }

    .banner--success .banner__dismiss:hover {
      background: color-mix(in srgb, var(--color-success) 20%, transparent);
      color: var(--color-success);
    }

    .banner--info .banner__dismiss:hover {
      background: color-mix(in srgb, var(--color-info) 20%, transparent);
      color: var(--color-info);
    }
  `],
})
export class ErrorBannerComponent {
  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * The alert message text to display.
   * Required.
   */
  readonly message = input.required<string>();

  /**
   * Visual variant of the banner.
   * - `error`: Red theme (default) — for destructive errors
   * - `warning`: Yellow/amber theme — for cautionary messages
   * - `success`: Green theme — for positive confirmations
   * - `info`: Blue theme — for informational notices
   * @default 'error'
   */
  readonly type = input<BannerType>('error');

  /**
   * Whether the banner shows a dismissible close button.
   * @default true
   */
  readonly dismissible = input<boolean>(true);

  /**
   * Auto-dismiss timeout in milliseconds.
   * 0 means no auto-dismiss — user must manually dismiss.
   * @default 0
   */
  readonly autoDismiss = input<number>(0);

  // ==========================================================================
  // SIGNAL OUTPUTS
  // ==========================================================================

  /**
   * Emitted when the banner is dismissed (by user or auto-dismiss timer).
   */
  readonly dismiss = output<void>();

  // ==========================================================================
  // INTERNAL STATE
  // ==========================================================================

  /**
   * Internal dismissed state for exit animation.
   */
  protected readonly isDismissed = signal<boolean>(false);

  // ==========================================================================
  // AUTO-DISMISS TIMER
  // ==========================================================================

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Set up auto-dismiss timer if configured
    effect(() => {
      const timeout = this.autoDismiss();
      if (timeout > 0) {
        const timerId = setTimeout(() => {
          this.dismissBanner();
        }, timeout);

        // Clean up timer on component destroy or when autoDismiss changes
        this.destroyRef.onDestroy(() => {
          clearTimeout(timerId);
        });
      }
    });
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle dismiss action (button click or auto-dismiss).
   * Triggers exit animation then emits the dismiss output.
   */
  protected onDismiss(): void {
    this.dismissBanner();
  }

  /**
   * Internal dismiss with animation delay.
   */
  private dismissBanner(): void {
    this.isDismissed.set(true);

    // Wait for exit animation then emit
    setTimeout(() => {
      this.dismiss.emit();
    }, 150);
  }
}
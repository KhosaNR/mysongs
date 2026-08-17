/**
 * Toast notification container component.
 *
 * Renders the current queue of toasts from ToastService in a fixed-position
 * container at the top-right of the viewport. Each toast appears with an
 * entrance slide-in animation, an optional progress bar showing remaining
 * time, and a dismiss button for manual removal.
 *
 * @example
 * ```html
 * <!-- Place in app shell template -->
 * <app-toast />
 * ```
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * Toast notification container component.
 *
 * Features:
 * - Fixed-position container at top-right of viewport
 * - Renders all active toasts from ToastService
 * - Four visual variants with semantic color coding (success/error/warning/info)
 * - Inline SVG icons per variant
 * - Entrance slide-in animation from the right
 * - Dismiss button on each toast
 * - Dismiss all button when multiple toasts are present
 * - WCAG accessible with aria-live region
 * - CSS custom property integration for theming
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-container"
      [class.toast-container--active]="toastService.hasToasts()"
      aria-live="polite"
      aria-relevant="all"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class.toast--success]="toast.type === 'success'"
          [class.toast--error]="toast.type === 'error'"
          [class.toast--warning]="toast.type === 'warning'"
          [class.toast--info]="toast.type === 'info'"
          role="status"
        >
          <div class="toast__content">
            <!-- Icon -->
            <span class="toast__icon" aria-hidden="true">
              @if (toast.type === 'error') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              } @else if (toast.type === 'warning') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              } @else if (toast.type === 'success') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              } @else {
                <!-- Info icon (default) -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              }
            </span>

            <!-- Message -->
            <span class="toast__message">{{ toast.message }}</span>
          </div>

          <!-- Dismiss Button -->
          @if (toast.dismissible) {
            <button
              type="button"
              class="toast__dismiss"
              (click)="dismissToast(toast.id)"
              aria-label="Dismiss notification"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
        </div>
      }

      <!-- Dismiss All Button (shown when 2+ toasts) -->
      @if (toastService.toasts().length > 1) {
        <button
          type="button"
          class="toast__dismiss-all"
          (click)="dismissAllToasts()"
          aria-label="Dismiss all notifications"
        >
          Dismiss all
        </button>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: var(--space-4);
      right: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-width: 420px;
      width: calc(100% - var(--space-8));
      pointer-events: none;
    }

    .toast-container--active {
      pointer-events: auto;
    }

    /* ========================================================================
       TOAST
       ======================================================================== */

    .toast {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-left: 4px solid;
      box-shadow: var(--shadow-lg);
      animation: toast-slide-in var(--transition-base) var(--ease-out);
    }

    @keyframes toast-slide-in {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* ========================================================================
       VARIANT STYLES
       ======================================================================== */

    .toast--success {
      border-left-color: var(--color-success);
    }

    .toast--error {
      border-left-color: var(--color-error);
    }

    .toast--warning {
      border-left-color: var(--color-warning);
    }

    .toast--info {
      border-left-color: var(--color-info);
    }

    /* ========================================================================
       CONTENT
       ======================================================================== */

    .toast__content {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      flex: 1;
      min-width: 0;
    }

    .toast__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .toast__icon svg {
      width: 100%;
      height: 100%;
    }

    .toast--success .toast__icon {
      color: var(--color-success);
    }

    .toast--error .toast__icon {
      color: var(--color-error);
    }

    .toast--warning .toast__icon {
      color: var(--color-warning);
    }

    .toast--info .toast__icon {
      color: var(--color-info);
    }

    .toast__message {
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

    .toast__dismiss {
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

    .toast__dismiss:hover {
      background: var(--color-hover);
      color: var(--text-primary);
    }

    .toast__dismiss svg {
      width: 16px;
      height: 16px;
    }

    /* ========================================================================
       DISMISS ALL BUTTON
       ======================================================================== */

    .toast__dismiss-all {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-3);
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: var(--text-sm);
      font-family: var(--font-family-primary);
      color: var(--text-secondary);
      transition: all var(--transition-fast);
      width: 100%;
    }

    .toast__dismiss-all:hover {
      background: var(--color-hover);
      color: var(--text-primary);
      border-color: var(--border-secondary);
    }

    /* ========================================================================
       RESPONSIVE
       ======================================================================== */

    @media (max-width: 480px) {
      .toast-container {
        top: var(--space-2);
        right: var(--space-2);
        width: calc(100% - var(--space-4));
        max-width: none;
      }

      .toast {
        padding: var(--space-2) var(--space-3);
      }
    }
  `],
})
export class ToastComponent {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================

  /**
   * The toast service managing the toast queue.
   */
  protected readonly toastService = inject(ToastService);

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Dismiss a specific toast by ID.
   */
  protected dismissToast(id: string): void {
    this.toastService.dismiss(id);
  }

  /**
   * Dismiss all active toasts.
   */
  protected dismissAllToasts(): void {
    this.toastService.dismissAll();
  }
}
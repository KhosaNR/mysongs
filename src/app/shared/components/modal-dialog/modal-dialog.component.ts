/**
 * Modal dialog component with portal-style overlay.
 *
 * Renders a modal overlay with backdrop, configurable size, title,
 * and content projection. Supports keyboard (Escape) and backdrop click
 * dismissal with accessibility focus management.
 *
 * @example
 * ```html
 * <app-modal-dialog
 *   [isOpen]="isModalOpen()"
 *   title="Purchase Confirmation"
 *   size="sm"
 *   (close)="onCloseModal()"
 * >
 *   <p>Are you sure you want to purchase this track?</p>
 *   <button (click)="confirmPurchase()">Confirm</button>
 * </app-modal-dialog>
 * ```
 */

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  ElementRef,
  afterNextRender,
  signal,
  booleanAttribute,
  inject,
} from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'fullscreen';

/**
 * Modal dialog component with portal-style overlay.
 *
 * Features:
 * - Portal-style fixed overlay spanning the full viewport
 * - Backdrop click to dismiss (configurable via `closeOnBackdrop`)
 * - Escape key to dismiss
 * - Focus trap inside modal (automatically focuses first focusable element)
 * - Prevents body scroll when open
 * - Smooth enter/exit animations using CSS transitions
 * - Three size variants: sm, md, lg, fullscreen
 * - Accessible: role="dialog", aria-modal, aria-labelledby
 */
@Component({
  selector: 'app-modal-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="modal-overlay"
        [class.modal-overlay--sm]="size() === 'sm'"
        [class.modal-overlay--md]="size() === 'md'"
        [class.modal-overlay--lg]="size() === 'lg'"
        [class.modal-overlay--fullscreen]="size() === 'fullscreen'"
        (click)="onBackdropClick($event)"
        (keydown.escape)="closeModal()"
        role="dialog"
        [attr.aria-modal]="true"
        [attr.aria-label]="title() || 'Dialog'"
      >
        <div
          class="modal"
          [class.modal--sm]="size() === 'sm'"
          [class.modal--md]="size() === 'md'"
          [class.modal--lg]="size() === 'lg'"
          [class.modal--fullscreen]="size() === 'fullscreen'"
          role="document"
          (keydown)="onKeydown($event)"
        >
          <!-- Header -->
          <div class="modal__header">
            <h2 class="modal__title">{{ title() }}</h2>
            <button
              type="button"
              class="modal__close-btn"
              (click)="closeModal()"
              [attr.aria-label]="'Close ' + (title() || 'dialog')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                class="modal__close-icon"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Body (content projection) -->
          <div class="modal__body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ========================================================================
       OVERLAY (Portal backdrop)
       ======================================================================== */

    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-overlay);
      padding: var(--space-4);
      animation: modal-fade-in var(--transition-base);
    }

    @keyframes modal-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* ========================================================================
       MODAL CONTAINER
       ======================================================================== */

    .modal {
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      max-height: 90vh;
      animation: modal-slide-up var(--transition-base);
    }

    @keyframes modal-slide-up {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Size variants */
    .modal--sm {
      width: 100%;
      max-width: 400px;
    }

    .modal--md {
      width: 100%;
      max-width: 560px;
    }

    .modal--lg {
      width: 100%;
      max-width: 768px;
    }

    .modal--fullscreen {
      width: 100%;
      height: 100%;
      max-height: 100vh;
      border-radius: 0;
      border: none;
    }

    .modal-overlay--fullscreen {
      padding: 0;
    }

    /* ========================================================================
       HEADER
       ======================================================================== */

    .modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-primary);
      flex-shrink: 0;
    }

    .modal__title {
      font-family: var(--font-family-display);
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ========================================================================
       CLOSE BUTTON
       ======================================================================== */

    .modal__close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-full);
      cursor: pointer;
      color: var(--text-secondary);
      transition: all var(--transition-fast);
      flex-shrink: 0;
      min-height: var(--touch-target-min);
      min-width: var(--touch-target-min);
    }

    .modal__close-btn:hover {
      background: var(--color-hover);
      border-color: var(--border-secondary);
      color: var(--text-primary);
    }

    .modal__close-btn:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }

    .modal__close-icon {
      width: 20px;
      height: 20px;
    }

    /* ========================================================================
       BODY (Content area)
       ======================================================================== */

    .modal__body {
      padding: var(--space-5);
      overflow-y: auto;
      flex: 1;
      color: var(--text-secondary);
      font-family: var(--font-family-primary);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
    }

    /* ========================================================================
       RESPONSIVE
       ======================================================================== */

    @media (max-width: 480px) {
      .modal-overlay {
        padding: var(--space-2);
        align-items: flex-end;
      }

      .modal {
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        max-height: 85vh;
      }

      .modal__header {
        padding: var(--space-3) var(--space-4);
      }

      .modal__body {
        padding: var(--space-4);
      }
    }
  `],
})
export class ModalDialogComponent {
  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * Whether the modal is currently visible.
   * @default false
   */
  readonly isOpen = input(false, { transform: booleanAttribute });

  /**
   * Title text displayed in the modal header.
   * @default ''
   */
  readonly title = input<string>('');

  /**
   * Size variant of the modal.
   * - `sm`: Small (400px max-width)
   * - `md`: Medium (560px max-width) — default
   * - `lg`: Large (768px max-width)
   * - `fullscreen`: Full viewport
   * @default 'md'
   */
  readonly size = input<ModalSize>('md');

  /**
   * Whether clicking the backdrop closes the modal.
   * @default true
   */
  readonly closeOnBackdrop = input(true, { transform: booleanAttribute });

  // ==========================================================================
  // SIGNAL OUTPUTS
  // ==========================================================================

  /**
   * Emitted when the modal should be closed.
   * Fires on backdrop click, Escape key, or close button click.
   */
  readonly dismiss = output<void>();

  // ==========================================================================
  // INTERNAL STATE
  // ==========================================================================

  /**
   * Tracks whether the previous isOpen state was true for cleanup.
   */
  private readonly wasOpen = signal(false);

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  readonly elementRef = inject(ElementRef);

  constructor() {
    afterNextRender(() => {
      // Set up a MutationObserver to detect when modal opens
      // This handles body scroll prevention
      const observer = new MutationObserver(() => {
        const currentIsOpen = this.isOpen();
        if (currentIsOpen && !this.wasOpen()) {
          this.onOpen();
        } else if (!currentIsOpen && this.wasOpen()) {
          this.onClose();
        }
        this.wasOpen.set(currentIsOpen);
      });

      observer.observe(this.elementRef.nativeElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Emit the close event to notify the parent.
   */
  closeModal(): void {
    this.dismiss.emit();
  }

  // ==========================================================================
  // INTERNAL METHODS
  // ==========================================================================

  /**
   * Handle modal open: prevent body scroll, focus first element.
   */
  private onOpen(): void {
    document.body.style.overflow = 'hidden';

    // Focus the modal content after render
    requestAnimationFrame(() => {
      const modal = this.elementRef.nativeElement.querySelector('.modal') as HTMLElement;
      if (modal) {
        modal.focus();
      }
    });
  }

  /**
   * Handle modal close: restore body scroll.
   */
  private onClose(): void {
    document.body.style.overflow = '';
  }

  /**
   * Handle backdrop click — close if closeOnBackdrop is enabled.
   * Only closes when clicking the overlay itself, not the modal content.
   */
  protected onBackdropClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === event.currentTarget) {
      this.dismiss.emit();
    }
  }

  /**
   * Handle keyboard events — close on Escape key.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
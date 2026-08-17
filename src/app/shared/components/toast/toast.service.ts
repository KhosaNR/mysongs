/**
 * Toast notification service for global success/error/warning/info feedback.
 *
 * Provides a programmatic API for showing toast notifications that stack
 * vertically in a fixed container. Toasts auto-dismiss after a configurable
 * duration, with an optional persistent mode.
 *
 * @example
 * ```typescript
 * // In any component or service
 * private readonly toast = inject(ToastService);
 *
 * // Simple success toast
 * this.toast.success('Track purchased successfully!');
 *
 * // Custom error toast with 8 second duration
 * this.toast.error('Failed to load tracks', { duration: 8000 });
 *
 * // Persistent toast (no auto-dismiss)
 * this.toast.show('Processing your payment...', { duration: 0 });
 *
 * // Dismiss a specific toast by reference
 * const ref = this.toast.show('Download starting...');
 * ref.dismiss();
 *
 * // Dismiss all toasts at once
 * this.toast.dismissAll();
 * ```
 */

import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Options for configuring a toast notification.
 */
export interface ToastOptions {
  /**
   * Visual type of the toast.
   * @default 'info'
   */
  type?: ToastType;

  /**
   * Auto-dismiss duration in milliseconds.
   * 0 means the toast persists until manually dismissed.
   * @default 5000
   */
  duration?: number;

  /**
   * Whether the toast shows a dismissible close button.
   * @default true
   */
  dismissible?: boolean;
}

/**
 * Internal toast data model.
 */
export interface Toast {
  /** Unique identifier for the toast. */
  readonly id: string;

  /** The toast message text. */
  readonly message: string;

  /** Visual type of the toast. */
  readonly type: ToastType;

  /** Auto-dismiss duration in ms (0 = persistent). */
  readonly duration: number;

  /** Whether the close button is shown. */
  readonly dismissible: boolean;

  /** Timestamp when the toast was created. */
  readonly createdAt: number;
}

/**
 * Reference to an active toast, allowing programmatic dismissal.
 */
export interface ToastRef {
  /** The toast's unique identifier. */
  readonly id: string;

  /** Programmatically dismiss this toast. */
  dismiss(): void;
}

/**
 * Global toast notification service.
 *
 * Provides a Signal-based queue of active toasts with auto-dismiss
 * and manual dismiss capabilities. Designed to be used with the
 * ToastComponent for rendering.
 *
 * @remarks
 * This service is provided in root, making it available app-wide
 * as a singleton. The companion ToastComponent should be placed
 * in the app shell template to render toasts.
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  // ==========================================================================
  // INTERNAL STATE
  // ==========================================================================

  /**
   * Internal signal holding the queue of active toasts.
   * Newest toasts are prepended to appear at the top.
   */
  private readonly toastsSignal = signal<Toast[]>([]);

  /**
   * Counter for generating unique toast IDs.
   */
  private nextId = 0;

  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================

  /**
   * Reactive signal of the current toast queue.
   * Components should use this to render the toast list.
   */
  readonly toasts = this.toastsSignal.asReadonly();

  /**
   * Whether there are any active toasts.
   */
  readonly hasToasts = computed(() => this.toastsSignal().length > 0);

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Show a toast notification with the given message and options.
   *
   * @param message - The message text to display
   * @param options - Optional configuration for type, duration, and dismissibility
   * @returns A ToastRef for programmatic dismissal
   *
   * @example
   * ```typescript
   * const ref = toastService.show('Download complete', {
   *   type: 'success',
   *   duration: 3000,
   * });
   * ```
   */
  show(message: string, options?: ToastOptions): ToastRef {
    const {
      type = 'info',
      duration = 5000,
      dismissible = true,
    } = options ?? {};

    const id = this.generateId();
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      dismissible,
      createdAt: Date.now(),
    };

    // Prepend to show newest at top
    this.toastsSignal.update((current) => [toast, ...current]);

    // Set up auto-dismiss if duration > 0
    let dismissTimerId: ReturnType<typeof setTimeout> | null = null;
    if (duration > 0) {
      dismissTimerId = setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }

    return {
      id,
      dismiss: () => {
        if (dismissTimerId !== null) {
          clearTimeout(dismissTimerId);
          dismissTimerId = null;
        }
        this.removeToast(id);
      },
    };
  }

  /**
   * Show a success toast notification.
   *
   * @param message - The success message text
   * @param options - Optional override configuration
   * @returns A ToastRef for programmatic dismissal
   */
  success(message: string, options?: Omit<ToastOptions, 'type'>): ToastRef {
    return this.show(message, { ...options, type: 'success' });
  }

  /**
   * Show an error toast notification.
   *
   * @param message - The error message text
   * @param options - Optional override configuration
   * @returns A ToastRef for programmatic dismissal
   */
  error(message: string, options?: Omit<ToastOptions, 'type'>): ToastRef {
    return this.show(message, { ...options, type: 'error' });
  }

  /**
   * Show a warning toast notification.
   *
   * @param message - The warning message text
   * @param options - Optional override configuration
   * @returns A ToastRef for programmatic dismissal
   */
  warning(message: string, options?: Omit<ToastOptions, 'type'>): ToastRef {
    return this.show(message, { ...options, type: 'warning' });
  }

  /**
   * Show an info toast notification.
   *
   * @param message - The info message text
   * @param options - Optional override configuration
   * @returns A ToastRef for programmatic dismissal
   */
  info(message: string, options?: Omit<ToastOptions, 'type'>): ToastRef {
    return this.show(message, { ...options, type: 'info' });
  }

  /**
   * Dismiss a specific toast by its ID.
   *
   * @param id - The unique identifier of the toast to dismiss
   */
  dismiss(id: string): void {
    this.removeToast(id);
  }

  /**
   * Dismiss all active toasts immediately.
   */
  dismissAll(): void {
    this.toastsSignal.set([]);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Generate a unique toast ID.
   */
  private generateId(): string {
    this.nextId++;
    return `toast-${this.nextId}-${Date.now()}`;
  }

  /**
   * Remove a toast by its ID from the queue.
   *
   * @param id - The unique identifier of the toast to remove
   */
  private removeToast(id: string): void {
    this.toastsSignal.update((current) =>
      current.filter((toast) => toast.id !== id),
    );
  }
}
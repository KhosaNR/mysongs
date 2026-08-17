/**
 * Loading spinner and skeleton loader component.
 *
 * Provides two visual variants:
 * - `spinner`: Circular animated spinner for indeterminate loading states
 * - `skeleton`: Placeholder blocks for content-aware loading states
 *
 * @example
 * ```html
 * <!-- Spinner variant (default) -->
 * <app-loading-spinner variant="spinner" size="md" />
 *
 * <!-- Skeleton variant -->
 * <app-loading-spinner variant="skeleton" size="lg" label="Loading tracks..." />
 * ```
 */

import { Component, input, ChangeDetectionStrategy } from '@angular/core';

export type LoadingVariant = 'spinner' | 'skeleton';
export type LoadingSize = 'sm' | 'md' | 'lg';

/**
 * Loading spinner/skeleton component.
 *
 * Features:
 * - Circular spinner animation for indeterminate loading
 * - Skeleton placeholder blocks for content-aware loading
 * - Three size variants (sm/md/lg)
 * - Optional accessible label
 * - CSS custom property integration for theming
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="loading"
      [class.loading--spinner]="variant() === 'spinner'"
      [class.loading--skeleton]="variant() === 'skeleton'"
      [class.loading--sm]="size() === 'sm'"
      [class.loading--md]="size() === 'md'"
      [class.loading--lg]="size() === 'lg'"
      role="status"
      [attr.aria-label]="label() || 'Loading'"
    >
      @if (variant() === 'spinner') {
        <svg
          class="loading__spinner"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            class="loading__spinner-track"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            opacity="0.2"
          />
          <path
            class="loading__spinner-indicator"
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
      }

      @if (variant() === 'skeleton') {
        <div class="loading__skeleton" aria-hidden="true">
          <div class="loading__skeleton-block loading__skeleton--line"></div>
          <div class="loading__skeleton-block loading__skeleton--line loading__skeleton--shorter"></div>
          <div class="loading__skeleton-block loading__skeleton--line"></div>
        </div>
      }

      @if (label()) {
        <span class="loading__label">{{ label() }}</span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      color: var(--text-secondary);
    }

    /* ========================================================================
       SPINNER VARIANT
       ======================================================================== */

    .loading__spinner {
      animation: loading-spin 1s linear infinite;
    }

    .loading--sm .loading__spinner {
      width: 16px;
      height: 16px;
    }

    .loading--md .loading__spinner {
      width: 32px;
      height: 32px;
    }

    .loading--lg .loading__spinner {
      width: 48px;
      height: 48px;
    }

    .loading__spinner-indicator {
      animation: loading-dash 1.5s ease-in-out infinite;
      stroke: var(--accent-primary);
    }

    @keyframes loading-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes loading-dash {
      0% {
        stroke-dasharray: 1, 150;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -35;
      }
      100% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -124;
      }
    }

    /* ========================================================================
       SKELETON VARIANT
       ======================================================================== */

    .loading__skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
    }

    .loading__skeleton-block {
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      position: relative;
      overflow: hidden;
    }

    .loading__skeleton-block::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent,
        var(--color-hover),
        transparent
      );
      animation: loading-shimmer 1.5s infinite;
    }

    .loading__skeleton--line {
      height: 16px;
    }

    .loading__skeleton--shorter {
      width: 60%;
    }

    .loading--sm .loading__skeleton--line {
      height: 12px;
    }

    .loading--lg .loading__skeleton--line {
      height: 20px;
    }

    @keyframes loading-shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    /* ========================================================================
       LABEL
       ======================================================================== */

    .loading__label {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      font-family: var(--font-family-primary);
    }
  `],
})
export class LoadingSpinnerComponent {
  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * Visual variant of the loader.
   * - `spinner`: Circular animated spinner (default)
   * - `skeleton`: Content placeholder blocks
   * @default 'spinner'
   */
  readonly variant = input<LoadingVariant>('spinner');

  /**
   * Size of the loading indicator.
   * - `sm`: Small (16px spinner / compact skeleton)
   * - `md`: Medium (32px spinner / default skeleton)
   * - `lg`: Large (48px spinner / tall skeleton)
   * @default 'md'
   */
  readonly size = input<LoadingSize>('md');

  /**
   * Optional accessible label describing what is loading.
   * Displayed below the spinner/skeleton when provided.
   * @default ''
   */
  readonly label = input<string>('');
}
/**
 * Empty state component for displaying placeholder content when lists
 * or views have no data.
 *
 * Provides several icon variants (empty box, search, music, cart) with
 * contextual messaging and an optional action button. All empty states
 * render at a single standard height across every screen.
 *
 * @example
 * ```html
 * <!-- No tracks in playlist -->
 * <app-empty-state
 *   icon="music"
 *   title="This playlist is empty"
 *   description="Add some tracks to get started"
 *   actionLabel="Browse tracks"
 * />
 *
 * <!-- No search results -->
 * <app-empty-state
 *   icon="search"
 *   title="No results found"
 *   description="Try different keywords or browse our catalog"
 * />
 *
 * <!-- No purchases yet -->
 * <app-empty-state
 *   icon="cart"
 *   title="No purchases yet"
 *   description="Streaming is free! Purchase tracks to download and listen offline"
 *   actionLabel="Browse tracks"
 * />
 * ```
 */

import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

export type EmptyStateIcon = 'empty-box' | 'search' | 'music' | 'cart' | 'album' | 'queue_music';

/**
 * Empty state component for placeholder display.
 *
 * Features:
 * - Five icon variants covering common empty states (empty-box, search, music, cart)
 * - Custom SVG icons per variant
 * - Primary title heading
 * - Secondary description text
 * - Optional action CTA button
 * - Single standard height used on every screen (no size variants)
 * - Router link support for action button
 * - CSS custom property integration for theming
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="empty-state"
      role="status"
    >
      <!-- Icon -->
      <div class="empty-state__icon" aria-hidden="true">
        @if (icon() === 'search') {
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="28" cy="28" r="18"/>
            <line x1="40" y1="40" x2="54" y2="54"/>
            <line x1="22" y1="24" x2="34" y2="24"/>
            <line x1="28" y1="18" x2="28" y2="30"/>
          </svg>
        } @else if (icon() === 'music') {
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M24 50V18l24-4v32"/>
            <circle cx="18" cy="50" r="6"/>
            <circle cx="48" cy="46" r="6"/>
            <line x1="24" y1="18" x2="48" y2="14"/>
          </svg>
        } @else if (icon() === 'cart') {
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8h8l5 28h34l6-20H18"/>
            <circle cx="24" cy="52" r="4"/>
            <circle cx="48" cy="52" r="4"/>
            <line x1="14" y1="36" x2="52" y2="36"/>
          </svg>
        } @else if (icon() === 'album') {
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="32" cy="32" r="24"/>
            <circle cx="32" cy="32" r="7"/>
            <line x1="32" y1="39" x2="32" y2="46"/>
          </svg>
        } @else if (icon() === 'queue_music') {
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="16" x2="52" y2="16"/>
            <line x1="12" y1="28" x2="52" y2="28"/>
            <line x1="12" y1="40" x2="28" y2="40"/>
            <path d="M44 40v14"/>
            <circle cx="38" cy="52" r="6"/>
            <circle cx="50" cy="48" r="6"/>
          </svg>
        } @else {
          <!-- empty-box (default) -->
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="12" width="52" height="44" rx="4"/>
            <line x1="6" y1="24" x2="58" y2="24"/>
            <line x1="28" y1="34" x2="36" y2="34"/>
            <polyline points="24,30 28,34 24,38"/>
            <polyline points="40,30 36,34 40,38"/>
          </svg>
        }
      </div>

      <!-- Text Content -->
      <h3 class="empty-state__title">{{ title() }}</h3>

      @if (description()) {
        <p class="empty-state__description">{{ description() }}</p>
      }

      <!-- Action Button -->
      @if (actionLabel()) {
        <div class="empty-state__actions">
          <button
            type="button"
            class="empty-state__action-btn"
            (click)="onActionClick()"
          >
            {{ actionLabel() }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-6) var(--space-4);
      gap: var(--space-4);
    }

    /* ========================================================================
       ICON
       ======================================================================== */

    .empty-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      color: var(--text-tertiary);
      opacity: 0.5;
    }

    .empty-state__icon svg {
      width: 100%;
      height: 100%;
    }

    /* ========================================================================
       TITLE
       ======================================================================== */

    .empty-state__title {
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: 0;
      font-family: var(--font-family-display);
    }

    /* ========================================================================
       DESCRIPTION
       ======================================================================== */

    .empty-state__description {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: var(--leading-relaxed);
      max-width: 400px;
      margin: 0;
    }

    /* ========================================================================
       ACTION BUTTON
       ======================================================================== */

    .empty-state__actions {
      margin-top: var(--space-2);
    }

    .empty-state__action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-5);
      background: var(--accent-primary);
      color: var(--text-inverse);
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--text-base);
      font-weight: var(--weight-medium);
      font-family: var(--font-family-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
      min-height: var(--touch-target-min);
    }

    .empty-state__action-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .empty-state__action-btn:active {
      transform: translateY(0);
    }

    .empty-state__action-btn:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  `],
})
export class EmptyStateComponent {
  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * Icon variant to display.
   * - `empty-box`: Generic empty box (default)
   * - `search`: Magnifying glass for no search results
   * - `music`: Music note for empty playlists
   * - `cart`: Shopping cart for no purchases
   * @default 'empty-box'
   */
  readonly icon = input<EmptyStateIcon>('empty-box');

  /**
   * Primary heading text.
   * @default 'Nothing here yet'
   */
  readonly title = input<string>('Nothing here yet');

  /**
   * Secondary descriptive text explaining the empty state.
   * @default ''
   */
  readonly description = input<string>('');

  /**
   * Label for the optional action CTA button.
   * Empty string hides the button entirely.
   * @default ''
   */
  readonly actionLabel = input<string>('');

  // ==========================================================================
  // SIGNAL OUTPUTS
  // ==========================================================================

  /**
   * Emitted when the action button is clicked.
   * Use this when no router link is provided.
   */
  readonly action = output<void>();

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle action button click.
   */
  protected onActionClick(): void {
    this.action.emit();
  }
}
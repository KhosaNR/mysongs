/**
 * Theme toggle component for switching between dark and light modes.
 * 
 * Provides a button that toggles between dark/light themes with
 * system preference detection and smooth transitions.
 * 
 * @example
 * ```html
 * <app-theme-toggle></app-theme-toggle>
 * ```
 */

import { Component, inject, computed } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Theme toggle button component
 * 
 * Features:
 * - Toggle between dark and light modes
 * - Visual feedback with sun/moon icons
 * - Respects system preferences in 'auto' mode
 * - Smooth transitions between themes
 */
@Component({
  selector: 'lb-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [class.theme-toggle--dark]="isDarkMode()"
      [class.theme-toggle--light]="!isDarkMode()"
      (click)="toggleTheme()"
      [attr.aria-label]="'Switch to ' + (isDarkMode() ? 'light' : 'dark') + ' mode'"
      [title]="'Switch to ' + (isDarkMode() ? 'light' : 'dark') + ' mode'"
    >
      @if (isDarkMode()) {
        <!-- Sun icon (shown in dark mode) -->
        <svg
          class="theme-toggle__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      }

      @if (!isDarkMode()) {
        <!-- Moon icon (shown in light mode) -->
        <svg
          class="theme-toggle__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      }

      <span class="theme-toggle__label">{{ label() }}</span>
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: var(--font-family-primary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      cursor: pointer;
      transition: all var(--transition-base);
      min-height: var(--touch-target-min);
      min-width: var(--touch-target-min);
    }

    .theme-toggle:hover {
      background: var(--color-hover);
      border-color: var(--border-secondary);
      transform: translateY(-1px);
    }

    .theme-toggle:active {
      background: var(--color-active);
      transform: translateY(0);
    }

    .theme-toggle:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }

    .theme-toggle__icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      transition: transform var(--transition-base);
    }

    .theme-toggle:hover .theme-toggle__icon {
      transform: rotate(15deg);
    }

    .theme-toggle__label {
      white-space: nowrap;
    }

    // Hide label on small screens
    @media (max-width: 480px) {
      .theme-toggle__label {
        display: none;
      }
    }
  `],
})
export class ThemeToggleComponent {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================
  
  private readonly themeService = inject(ThemeService);

  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================
  
  /**
   * Whether dark mode is currently active
   */
  readonly isDarkMode = this.themeService.isDarkMode;

  /**
   * Button label based on current theme
   */
  readonly label = computed(() => {
    return this.isDarkMode() ? 'Light mode' : 'Dark mode';
  });

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================
  
  /**
   * Toggle between dark and light modes
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
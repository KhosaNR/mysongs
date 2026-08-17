/**
 * Theme selector component for choosing theme sources.
 * 
 * Allows users to select between:
 * - Artist theme (dynamic, from Firestore)
 * - Album theme (dynamic, from Firestore)
 * - Song theme (dynamic, from Firestore)
 * - Manual override (color picker)
 * 
 * All theme colors are stored in Firestore at the artist/album/song level
 * and loaded via ThemeService's inheritance chain.
 * 
 * @example
 * ```html
 * <app-theme-selector></app-theme-selector>
 * ```
 */

import { Component, inject, signal, computed } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { DEFAULT_PLATFORM_COLORS } from '../../../core/constants/theme.constants';
import { ThemeColors } from '../../models/artist.interface';

/**
 * Theme source options matching the Firestore inheritance chain
 */
export type ThemeSource = 'artist' | 'album' | 'song' | 'manual';

/**
 * Theme selector component
 * 
 * Features:
 * - Select theme source (artist/album/song/manual)
 * - Loads colors from Firestore via ThemeService
 * - Displays current color swatches for the active theme
 * - Manual color picker for custom colors
 * - Reset to default option
 * - Reactive updates via Signals
 */
@Component({
  selector: 'app-theme-selector',
  standalone: true,
  template: `
    <div class="theme-selector">
      <h3 class="theme-selector__title">Theme Source</h3>

      @if (currentColors()) {
        <div class="theme-selector__swatches">
          <div class="theme-selector__swatch-grid">
            <span class="theme-selector__swatch-header theme-selector__swatch-header--corner" aria-hidden="true"></span>
            <span class="theme-selector__swatch-header">Primary</span>
            <span class="theme-selector__swatch-header">Secondary</span>
            <span class="theme-selector__swatch-header">Tertiary</span>

            @for (row of swatchRows; track row.label) {
              <span class="theme-selector__swatch-header theme-selector__swatch-header--label">{{ row.label }}</span>
              @for (cell of row.cells; track cell) {
                <span
                  class="theme-selector__swatch"
                  [class.theme-selector__swatch--glyph]="row.label === 'Foreground'"
                  [style.background-color]="swatchBackground(cell)"
                  [style.color]="swatchValue(cell)"
                  [title]="swatchValue(cell)"
                >{{ row.label === 'Foreground' ? 'Aa' : '' }}</span>
              }
            }
          </div>
        </div>
      }

      <div class="theme-selector__options">
        <!-- Artist Theme -->
        <button
          type="button"
          class="theme-selector__option"
          [class.theme-selector__option--active]="selectedSource() === 'artist'"
          (click)="selectSource('artist')"
          [disabled]="isLoading()"
        >
          <svg class="theme-selector__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Artist Theme</span>
        </button>

        <!-- Album Theme -->
        <button
          type="button"
          class="theme-selector__option"
          [class.theme-selector__option--active]="selectedSource() === 'album'"
          (click)="selectSource('album')"
          [disabled]="isLoading()"
        >
          <svg class="theme-selector__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Album Theme</span>
        </button>

        <!-- Song Theme -->
        <button
          type="button"
          class="theme-selector__option"
          [class.theme-selector__option--active]="selectedSource() === 'song'"
          (click)="selectSource('song')"
          [disabled]="isLoading()"
        >
          <svg class="theme-selector__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <span>Song Theme</span>
        </button>

        <!-- Manual Override -->
        <button
          type="button"
          class="theme-selector__option"
          [class.theme-selector__option--active]="selectedSource() === 'manual'"
          (click)="selectSource('manual')"
        >
          <svg class="theme-selector__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="13.5" cy="6.5" r="2.5"></circle>
            <circle cx="17.5" cy="10.5" r="2.5"></circle>
            <circle cx="8.5" cy="7.5" r="2.5"></circle>
            <circle cx="6.5" cy="12.5" r="2.5"></circle>
            <path d="M12 22v-6"></path>
            <path d="M9 16l3-3 3 3"></path>
          </svg>
          <span>Custom</span>
        </button>
      </div>

      <!-- Manual Color Picker -->
      @if (selectedSource() === 'manual') {
        <div class="theme-selector__manual">
          <h4 class="theme-selector__subtitle">Custom Colors</h4>

          <div class="theme-selector__colors">
            <label class="theme-selector__color-label">
              <span>Primary</span>
              <input
                type="color"
                [value]="customColors().primary || defaultColors.primary"
                (change)="updateCustomColor('primary', $event)"
              />
            </label>

            <label class="theme-selector__color-label">
              <span>Secondary</span>
              <input
                type="color"
                [value]="customColors().secondary || defaultColors.secondary"
                (change)="updateCustomColor('secondary', $event)"
              />
            </label>

            <label class="theme-selector__color-label">
              <span>Tertiary</span>
              <input
                type="color"
                [value]="customColors().tertiary || defaultColors.tertiary"
                (change)="updateCustomColor('tertiary', $event)"
              />
            </label>
          </div>
        </div>
      }

      <p class="theme-selector__hint">
        Colors are loaded from the <strong>{{ selectedSource() }}</strong>
        {{ selectedSource() === 'manual' ? 'color picker' : 'Firestore configuration' }}.
        Inheritance: song to album to artist to defaults.
      </p>

      <button
        type="button"
        class="theme-selector__reset"
        (click)="resetToDefault()"
      >
        Reset to Default
      </button>
    </div>
  `,
  styles: [`
    .theme-selector {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-lg);
    }

    .theme-selector__title {
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .theme-selector__swatches {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .theme-selector__swatch-grid {
      display: grid;
      grid-template-columns: 5.5rem repeat(3, 1fr);
      gap: var(--space-2) var(--space-3);
      align-items: center;
    }

    .theme-selector__swatch-header {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
    }

    .theme-selector__swatch-header--corner {
      visibility: hidden;
    }

    .theme-selector__swatch-header--label {
      color: var(--text-tertiary);
      font-weight: var(--weight-medium);
    }

    .theme-selector__swatch {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      border: 2px solid var(--border-primary);
      cursor: help;
    }

    .theme-selector__swatch--glyph {
      font-family: var(--font-family-display);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
    }

    .theme-selector__options {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);
    }

    .theme-selector__option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--bg-secondary);
      border: 2px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-family: var(--font-family-primary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      cursor: pointer;
      transition: all var(--transition-base);
      min-height: var(--touch-target-min);
    }

    .theme-selector__option:hover:not(:disabled) {
      background: var(--color-hover);
      border-color: var(--border-secondary);
      color: var(--text-primary);
      transform: translateY(-2px);
    }

    .theme-selector__option:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .theme-selector__option--active {
      background: var(--color-active);
      border-color: var(--accent-primary);
      color: var(--text-primary);
    }

    .theme-selector__icon {
      width: 24px;
      height: 24px;
    }

    .theme-selector__manual {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .theme-selector__subtitle {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .theme-selector__colors {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .theme-selector__color-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }

    .theme-selector__color-label input[type="color"] {
      width: 48px;
      height: 32px;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      background: transparent;
      padding: 2px;
    }

    .theme-selector__hint {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      line-height: var(--leading-relaxed);
      margin: 0;
      padding: var(--space-2);
      background: var(--bg-secondary);
      border-radius: var(--radius-sm);
    }

    .theme-selector__reset {
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-family: var(--font-family-primary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      cursor: pointer;
      transition: all var(--transition-base);
      min-height: var(--touch-target-min);
    }

    .theme-selector__reset:hover {
      background: var(--color-hover);
      border-color: var(--color-error);
      color: var(--color-error);
    }

    .theme-selector__reset:active {
      background: var(--color-active);
    }
  `],
})
export class ThemeSelectorComponent {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================

  private readonly themeService = inject(ThemeService);

  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================

  /**
   * Currently selected theme source
   */
  readonly selectedSource = signal<ThemeSource>('artist');

  /**
   * Static platform defaults used as the manual-picker fallback values.
   */
  readonly defaultColors = DEFAULT_PLATFORM_COLORS;

  /**
   * Swatch matrix grouped by row (Color / Foreground / Container) across the
   * three brand hues (Primary | Secondary | Tertiary).
   */
  readonly swatchRows: readonly { label: string; cells: readonly (keyof ThemeColors)[] }[] = [
    { label: 'Color', cells: ['primary', 'secondary', 'tertiary'] },
    { label: 'Foreground', cells: ['foregroundPrimary', 'foregroundSecondary', 'foregroundTertiary'] },
    { label: 'Container', cells: ['containerPrimary', 'containerSecondary', 'containerTertiary'] },
  ];

  /**
   * Current active colors from ThemeService (reactive via Signals)
   */
  readonly currentColors = this.themeService.currentColors;

  /**
   * Whether a theme load operation is in progress
   */
  readonly isLoading = signal<boolean>(false);

  /**
   * Custom colors for manual mode, merged with current theme defaults
   */
  readonly customColors = computed(() => {
    const current = this.themeService.currentColors();
    const custom = this.themeService.customColors();
    return { ...current, ...custom };
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  constructor() {
    if (this.themeService.isDynamicTheme()) {
      this.selectedSource.set('artist');
    }
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Select theme source and load colors from Firestore
   * 
   * Loads colors via ThemeService's inheritance chain.
   * In a real implementation, the component receives current
   * song/album/artist IDs from the parent context and passes them here.
   * 
   * @param source - Theme source to select
   */
  async selectSource(source: ThemeSource): Promise<void> {
    this.selectedSource.set(source);

    if (source === 'manual') {
      return;
    }

    this.isLoading.set(true);
    try {
      await this.themeService.loadThemeColors(
        source === 'song' ? undefined : undefined,
        source === 'album' ? undefined : undefined,
        source === 'artist' ? undefined : undefined
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Background color for a swatch cell.
   * 
   * Foreground swatches render the 'Aa' glyph on top of their base hue so the
   * chosen text color stays legible; every other cell uses its own color.
   *
   * @param key - Palette key of the swatch cell
   * @returns The swatch background color
   */
  swatchBackground(key: keyof ThemeColors): string {
    const colors = { ...DEFAULT_PLATFORM_COLORS, ...this.currentColors() } as Required<ThemeColors>;

    if (key.startsWith('foreground')) {
      const hue = key.replace('foreground', '') as 'primary' | 'secondary' | 'tertiary';
      return colors[hue];
    }

    return colors[key];
  }

  /**
   * Current hex value for a swatch cell, falling back to the platform default
   * when the (optional) palette field is missing.
   *
   * @param key - Palette key of the swatch cell
   * @returns The color value to display/title
   */
  swatchValue(key: keyof ThemeColors): string {
    return { ...DEFAULT_PLATFORM_COLORS, ...this.currentColors() }[key] ?? '';
  }

  /**
   * Update custom color
   * 
   * @param colorType - Type of color to update (primary/secondary/tertiary)
   * @param event - Color input change event
   */
  updateCustomColor(colorType: 'primary' | 'secondary' | 'tertiary', event: Event): void {
    const input = event.target as HTMLInputElement;
    const color = input.value;

    const currentColors = this.themeService.customColors();
    this.themeService.setCustomColors({
      ...currentColors,
      [colorType]: color,
    });
  }

  /**
   * Reset to default theme
   */
  resetToDefault(): void {
    this.themeService.resetToDefault();
    this.selectedSource.set('artist');
  }
}
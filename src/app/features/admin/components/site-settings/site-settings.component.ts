import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeColors } from '../../../../shared/models/artist.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../../../core/services/theme.service';
import { getAccessibleTextColor } from '../../../../core/utils/color-extractor';
import { SiteSettingsService } from '../../../../core/services/site-settings.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

/** Brand hue columns in the color matrix. */
type Hue = 'primary' | 'secondary' | 'tertiary';

/** A single color matrix cell configuration. */
interface ColorCell {
  /** Palette key bound to the color input. */
  key: keyof ThemeColors;
  /** Column (hue) this cell belongs to. */
  hue: Hue;
}

/**
 * Admin "Site Settings / Appearance" page.
 *
 * Lets the system administrator choose the default platform brand palette,
 * grouped into a Primary | Secondary | Tertiary matrix where every hue carries
 * a Color, Foreground (text), and Container (tinted surface) row. Saving
 * persists the palette to `platform_settings/global` and applies it
 * immediately via ThemeService; artists can still override it with their own
 * themeColors on scoped pages.
 */
@Component({
  selector: 'app-site-settings',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  templateUrl: './site-settings.component.html',
  styleUrl: './site-settings.component.scss',
})
export class SiteSettingsComponent {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================

  private readonly siteSettingsService = inject(SiteSettingsService);

  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================

  readonly isLoading = this.siteSettingsService.isLoading;
  readonly isSaving = this.siteSettingsService.isSaving;
  readonly error = this.siteSettingsService.error;
  readonly saved = this.siteSettingsService.saved;

  /**
   * Editable palette bound to the color pickers.
   */
  readonly colors = signal<ThemeColors>({ ...DEFAULT_PLATFORM_COLORS });

  /**
   * Live WCAG contrast of the platform background against its automatically
   * chosen readable text color, shown as an accessibility hint in the UI.
   */
  readonly contrast = computed(() => ({
    background: this.siteSettingsService.contrastRatio(
      this.colors().background ?? DEFAULT_PLATFORM_COLORS.background!
    ),
  }));

  /**
   * Matrix column labels (Primary | Secondary | Tertiary).
   */
  readonly hues: readonly { key: Hue; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'tertiary', label: 'Tertiary' },
  ];

  /**
   * Matrix rows grouped by color role. Each row spans the three hues and
   * carries the palette keys bound to its color inputs.
   */
  readonly colorRows: readonly { label: string; cells: readonly ColorCell[] }[] = [
    {
      label: 'Color',
      cells: [
        { key: 'primary', hue: 'primary' },
        { key: 'secondary', hue: 'secondary' },
        { key: 'tertiary', hue: 'tertiary' },
      ],
    },
    {
      label: 'Foreground',
      cells: [
        { key: 'foregroundPrimary', hue: 'primary' },
        { key: 'foregroundSecondary', hue: 'secondary' },
        { key: 'foregroundTertiary', hue: 'tertiary' },
      ],
    },
    {
      label: 'Container',
      cells: [
        { key: 'containerPrimary', hue: 'primary' },
        { key: 'containerSecondary', hue: 'secondary' },
        { key: 'containerTertiary', hue: 'tertiary' },
      ],
    },
  ];

  /**
   * Platform background fallback shown when the palette has no explicit value.
   */
  readonly backgroundDefault = DEFAULT_PLATFORM_COLORS.background ?? '#000000';

  // ==========================================================================
  // PRIVATE STATE
  // ==========================================================================

  private synced = false;

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  constructor() {
    // Load persisted settings once and populate the form when available.
    void this.siteSettingsService.load();

    effect(() => {
      const settings = this.siteSettingsService.settings();
      if (settings && !this.synced) {
        this.colors.set({ ...settings.themeColors });
        this.synced = true;
      }
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Update a single palette color from a color input event.
   *
   * @param key - Palette key to update
   * @param event - Input change event
   */
  updateColor(key: keyof ThemeColors, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.colors.update((current) => ({ ...current, [key]: input.value }));
    this.siteSettingsService.saved.set(false);
  }

  /**
   * Live WCAG contrast hint for a palette matrix cell.
   *
   * - Foreground cells are measured against their base hue.
   * - Container cells are measured against their derived on-container text.
   * - Base hue cells are measured against their foreground (text) color.
   *
   * @param key - Palette key of the cell
   * @returns Contrast ratio string (e.g. '12.35')
   */
  hintFor(key: keyof ThemeColors): string {
    const colors = { ...DEFAULT_PLATFORM_COLORS, ...this.colors() } as Required<ThemeColors>;

    if (key.startsWith('foreground')) {
      const hue = key.replace('foreground', '') as Hue;
      return this.siteSettingsService.contrastBetween(colors[key], colors[hue]);
    }

    if (key.startsWith('container')) {
      return this.siteSettingsService.contrastBetween(
        getAccessibleTextColor(colors[key]),
        colors[key]
      );
    }

    const hue = key as Hue;
    const foregroundKey = `foreground${this.capitalize(hue)}` as keyof ThemeColors;
    return this.siteSettingsService.contrastBetween(colors[foregroundKey], colors[key]);
  }

  /**
   * Current hex value for a palette key, falling back to the platform default
   * when the palette is missing a (newer, optional) field.
   *
   * @param key - Palette key of the cell
   * @returns The color value to show in the picker
   */
  colorValue(key: keyof ThemeColors): string {
    return this.colors()[key] ?? '';
  }

  /**
   * Human-readable hue label for a matrix cell (used as the mobile caption).
   *
   * @param key - Palette key of the cell
   * @returns The capitalized hue label (e.g. 'Primary')
   */
  hueLabelFor(key: keyof ThemeColors): string {
    const hue = key.replace(/^(foreground|container)/, '');
    return this.capitalize(hue);
  }

  /**
   * Capitalize the first character of a string.
   *
   * @param value - Input string (e.g. 'tertiary')
   * @returns Capitalized string (e.g. 'Tertiary')
   */
  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  /**
   * Persist the current palette.
   */
  async onSave(): Promise<void> {
    try {
      await this.siteSettingsService.save(this.colors());
    } catch {
      // The error banner is driven by the service's error signal.
    }
  }

  /**
   * Revert the form and the live palette to the platform defaults.
   */
  onReset(): void {
    this.colors.set({ ...DEFAULT_PLATFORM_COLORS });
    this.siteSettingsService.resetToDefaults();
  }

  /**
   * Clear the error banner.
   */
  dismissError(): void {
    this.siteSettingsService.error.set(null);
  }
}

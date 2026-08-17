import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ThemeService } from './theme.service';
import { DEFAULT_PLATFORM_COLORS, normalizePalette } from '../constants/theme.constants';
import { ThemeColors } from '../../shared/models/artist.interface';
import { PlatformSettings } from '../../shared/models/platform-settings.interface';
import { getContrastRatio, getAccessibleTextColor } from '../utils/color-extractor';

/** Singleton document path for platform-wide site configuration. */
export const PLATFORM_SETTINGS_PATH = 'platform_settings/global';

/**
 * Service for loading and persisting admin-configured platform settings.
 *
 * Reads the singleton `platform_settings/global` document and forwards the
 * brand palette to ThemeService so it becomes the platform fallback for the
 * design tokens. Safe to call on every bootstrap — the load is guarded and
 * skipped during SSR.
 */
@Injectable({
  providedIn: 'root',
})
export class SiteSettingsService {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================

  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================

  /**
   * Currently persisted platform settings (null until loaded or if absent).
   */
  readonly settings = signal<PlatformSettings | null>(null);

  /**
   * Whether the settings document is being fetched.
   */
  readonly isLoading = signal<boolean>(false);

  /**
   * Whether a save operation is in flight (drives the disabled button state).
   */
  readonly isSaving = signal<boolean>(false);

  /**
   * Consumer-facing error message from the last save attempt.
   */
  readonly error = signal<string | null>(null);

  /**
   * True immediately after a successful save (auto-clears on next change).
   */
  readonly saved = signal<boolean>(false);

  // ==========================================================================
  // PRIVATE STATE
  // ==========================================================================

  private loaded = false;

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Loads the platform settings document (once) and applies its palette.
   *
   * Non-fatal on failure — the static design-token defaults remain active.
   * Skipped entirely during SSR where no browser document exists yet.
   */
  async load(): Promise<void> {
    if (typeof window === 'undefined' || this.loaded) {
      return;
    }

    this.isLoading.set(true);
    try {
      const snapshot = await getDoc(doc(this.firestore, 'platform_settings', 'global'));

      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<PlatformSettings>;
        const palette = data.themeColors;

        if (palette && this.isValidPalette(palette)) {
          // Normalize so every hue carries a foreground + container fallback
          // even when older documents only stored the base triple.
          const normalized = normalizePalette(palette);
          const settings: PlatformSettings = {
            id: data.id ?? 'global',
            themeColors: normalized,
            updatedAt: data.updatedAt ?? '',
            updatedBy: data.updatedBy ?? '',
          };
          this.settings.set(settings);
          this.themeService.setPlatformColors(normalized);
        }
      }
    } catch (error) {
      console.error('Failed to load platform settings:', error);
    } finally {
      this.isLoading.set(false);
      this.loaded = true;
    }
  }

  /**
   * Persists a new platform brand palette and applies it immediately.
   *
   * @param themeColors - Validated brand palette (hex codes)
   * @throws Error if the palette fails validation or the write is rejected
   */
  async save(themeColors: ThemeColors): Promise<void> {
    if (!this.isValidPalette(themeColors)) {
      this.error.set('Invalid colors — every value must be a 6-digit hex code.');
      throw new Error('Invalid platform palette');
    }

    this.isSaving.set(true);
    this.error.set(null);
    this.saved.set(false);

    try {
      const currentUser = this.authService.currentUser();
      const settings: PlatformSettings = {
        id: 'global',
        themeColors,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.userId ?? 'unknown',
      };

      await setDoc(doc(this.firestore, 'platform_settings', 'global'), settings);

      this.settings.set(settings);
      this.themeService.setPlatformColors(themeColors);
      this.saved.set(true);
    } catch (error) {
      this.error.set('Could not save site settings. Please try again.');
      console.error('Failed to save platform settings:', error);
      throw error;
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Reverts the live palette to the static platform defaults without writing.
   */
  resetToDefaults(): void {
    this.themeService.setPlatformColors({ ...DEFAULT_PLATFORM_COLORS });
    this.settings.set(null);
    this.saved.set(false);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Validates that every palette color is a 6-digit hex code.
   * 
   * Accepts partial palettes (legacy documents may store the third hue as
   * `accent`); the base triple is required, foreground/container/background
   * are validated when present and defaulted by `normalizePalette()`.
   * 
   * @param palette - Palette to validate
   * @returns Whether the palette is structurally valid
   */
  private isValidPalette(palette: Partial<ThemeColors>): boolean {
    const hex = /^#[0-9A-F]{6}$/i;
    const legacy = palette as Partial<ThemeColors> & { accent?: string };
    const tertiary = palette.tertiary ?? legacy.accent;

    if (!palette.primary || !palette.secondary || !tertiary) {
      return false;
    }

    if (!hex.test(palette.primary) || !hex.test(palette.secondary) || !hex.test(tertiary)) {
      return false;
    }

    const optionalColors = [
      palette.foregroundPrimary,
      palette.foregroundSecondary,
      palette.foregroundTertiary,
      palette.containerPrimary,
      palette.containerSecondary,
      palette.containerTertiary,
    ] as const;

    if (optionalColors.some((color) => color !== undefined && !hex.test(color))) {
      return false;
    }

    return palette.background === undefined || hex.test(palette.background);
  }

  /**
   * Computes the WCAG AA contrast of a color against its automatically chosen
   * readable text color. Used by the admin UI as a live accessibility hint.
   *
   * @param color - Background color (hex)
   * @returns Contrast ratio string (e.g. '12.35')
   */
  contrastRatio(color: string): string {
    const text = getAccessibleTextColor(color);
    return getContrastRatio(text, color).toFixed(2);
  }

  /**
   * Computes the WCAG contrast ratio between two explicit colors.
   * Used by the admin picker to show foreground-vs-hue and on-container text hints.
   *
   * @param foreground - Foreground color (hex)
   * @param background - Background color (hex)
   * @returns Contrast ratio string (e.g. '12.35')
   */
  contrastBetween(foreground: string, background: string): string {
    return getContrastRatio(foreground, background).toFixed(2);
  }
}


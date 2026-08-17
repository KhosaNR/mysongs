/**
 * Admin-configured platform-wide site settings.
 *
 * Persisted as a singleton document at `platform_settings/global`. The admin
 * Site Settings page writes the brand palette here; ThemeService applies it as
 * the platform fallback for the design tokens (`--accent-primary`,
 * `--accent-secondary`, `--color-error`, …) whenever no song/album/artist
 * theme is active.
 */
import type { ThemeColors } from './artist.interface';

export interface PlatformSettings {
  /**
   * Singleton document ID (`'global'`).
   * @format slug
   */
  readonly id: string;

  /**
   * Platform-wide brand palette (falls back to the static defaults).
   */
  readonly themeColors: ThemeColors;

  /**
   * ISO timestamp of the last update.
   * @format date-time
   */
  readonly updatedAt: string;

  /**
   * Public application user ID of the admin who last updated the settings.
   */
  readonly updatedBy: string;
}

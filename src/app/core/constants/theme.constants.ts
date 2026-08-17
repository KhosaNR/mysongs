/**
 * Centralized theme color constants — the single source of truth for the
 * My Songs brand palette and related contrast defaults.
 *
 * Components MUST reference these constants instead of inlining hex literals.
 * The runtime palette (artist → album → song → platform) is applied by
 * ThemeService; this file only defines the static fallback so every form and
 * swatch defaults consistently and admin-customized platform colors can be
 * layered on top.
 */

import { ThemeColors } from '../../shared/models/artist.interface';

/**
 * Default platform colors — the static fallback palette used before/without
 * admin platform settings. Mirrors `src/styles/_variables.scss` so the SSR
 * first paint matches the runtime theme.
 */
export const DEFAULT_PLATFORM_COLORS: ThemeColors = {
  primary: '#C5FCFB',
  secondary: '#2EF8FF',
  tertiary: '#e63946',
  foregroundPrimary: '#000000',
  foregroundSecondary: '#000000',
  foregroundTertiary: '#000000',
  containerPrimary: '#1E2626',
  containerSecondary: '#072526',
  containerTertiary: '#23090B',
  background: '#000000',
};

/**
 * Text color used on light backgrounds (luminance > 0.179).
 */
export const TEXT_ON_LIGHT = '#000000';

/**
 * Text color used on dark backgrounds (luminance <= 0.179).
 */
export const TEXT_ON_DARK = '#ffffff';

/**
 * Normalize a (possibly partial or legacy) palette into a complete
 * ThemeColors set by merging onto the platform defaults.
 * 
 * Legacy documents stored the third hue under `accent`; it is promoted to
 * `tertiary` so older artist/album/song/platform-setting docs keep their
 * colors without a data migration.
 * 
 * @param colors - Partial palette (e.g. read from Firestore)
 * @returns A complete palette with defaults for every missing field
 */
export function normalizePalette(colors: Partial<ThemeColors>): ThemeColors {
  const { accent, ...rest } = colors as Partial<ThemeColors> & { accent?: string };

  return {
    ...DEFAULT_PLATFORM_COLORS,
    ...rest,
    tertiary: rest.tertiary ?? accent ?? DEFAULT_PLATFORM_COLORS.tertiary,
  };
}

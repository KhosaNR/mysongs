/**
 * Color utility functions for theme management.
 * 
 * Provides WCAG contrast validation and color conversion utilities.
 * Note: Color extraction from images has been removed in favor of
 * artist-selected colors stored in Firestore.
 * 
 * @example
 * ```typescript
 * // Check if colors meet WCAG AA standards
 * const isAccessible = meetsWCAGAA('#ffffff', '#000000');
 * 
 * // Get accessible text color for a background
 * const textColor = getAccessibleTextColor('#ffb800');
 * ```
 */

/**
 * Convert RGB values to hex color string
 * 
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string (e.g., '#ffb800')
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex color to RGB
 * 
 * @param hex - Hex color string (e.g., '#ffb800')
 * @returns RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Calculate relative luminance of a color
 * Used for WCAG contrast ratio calculations
 * 
 * @param hex - Hex color string
 * @returns Relative luminance value (0-1)
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  
  if (!rgb) {
    return 0;
  }
  
  const { r, g, b } = rgb;
  
  // Normalize RGB values
  const normalize = (c: number) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

/**
 * Calculate contrast ratio between two colors
 * 
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const lum1 = getRelativeLuminance(foreground);
  const lum2 = getRelativeLuminance(background);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color combination meets WCAG AA standards
 * 
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param isLargeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns Whether combination is accessible
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  
  // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if color combination meets WCAG AAA standards
 * 
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param isLargeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns Whether combination is accessible
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  
  // WCAG AAA requires 7:1 for normal text, 4.5:1 for large text
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Get accessible text color for a given background
 * 
 * @param backgroundColor - Background color (hex)
 * @returns Accessible text color (white or black)
 */
export function getAccessibleTextColor(backgroundColor: string): string {
  const luminance = getRelativeLuminance(backgroundColor);
  
  // Use white text on dark backgrounds, black text on light backgrounds
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
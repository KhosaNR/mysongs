/**
 * Manages application theming with Angular Signals for reactive updates.
 * 
 * Supports:
 * - Dark mode (default)
 * - Light mode
 * - Dynamic background theming from artist/album/song colors
 * - Theme preference persistence
 * 
 * @example
 * ```typescript
 * // Inject the service
 * const themeService = inject(ThemeService);
 * 
 * // React to theme changes
 * themeService.currentTheme().subscribe(theme => {
 *   console.log('Current theme:', theme);
 * });
 * 
 * // Toggle between dark and light
 * themeService.toggleTheme();
 * 
 * // Load theme colors for current song
 * themeService.loadThemeColors('song_123');
 * ```
 */

import { Injectable, signal, computed, effect, DOCUMENT } from '@angular/core';
import { inject } from '@angular/core';
import { Firestore, doc, updateDoc, getDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { DEFAULT_PLATFORM_COLORS, TEXT_ON_DARK, TEXT_ON_LIGHT, normalizePalette } from '../constants/theme.constants';
import { getAccessibleTextColor, getContrastRatio } from '../utils/color-extractor';
import { ThemeColors } from '../../shared/models/artist.interface';

// Re-exported for backwards compatibility — consumers should prefer the
// canonical `theme.constants` module.
export { DEFAULT_PLATFORM_COLORS } from '../constants/theme.constants';

/**
 * Theme mode options
 */
export type ThemeMode = 'dark' | 'light' | 'auto';

/**
 * Theme preference structure for Firestore persistence
 */
export interface ThemePreference {
  mode: ThemeMode;
  customColors?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  updatedAt: string;
}

/**
 * Default platform colors — single source of truth is
 * `src/app/core/constants/theme.constants.ts` (re-exported above).
 */

/**
 * Service for managing application theming with reactive Signals.
 * 
 * Features:
 * - Dark/light mode toggling
 * - Dynamic background theming from artist/album/song colors
 * - Theme preference persistence in Firestore
 * - System preference detection
 * - WCAG AA contrast validation
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================
  
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  // ==========================================================================
  // PRIVATE STATE
  // ==========================================================================
  
  /**
   * Current theme mode (dark, light, or auto)
   */
  private readonly _themeMode = signal<ThemeMode>('dark');
  
  /**
   * Current theme colors from artist/album/song
   */
  private readonly _themeColors = signal<ThemeColors>(DEFAULT_PLATFORM_COLORS);
  
  /**
   * Whether dynamic theming is active
   */
  private readonly _isDynamicTheme = signal<boolean>(false);
  
  /**
   * User's custom color overrides (if any)
   */
  private readonly _customColors = signal<Partial<ThemeColors>>({});

  /**
   * Admin-configured platform default colors (from `settings/platform`).
   * Used whenever no song/album/artist theme is active.
   */
  private readonly _platformColors = signal<ThemeColors>(DEFAULT_PLATFORM_COLORS);

  // ==========================================================================
  // PUBLIC SIGNALS
  // ==========================================================================
  
  /**
   * Current theme mode signal
   */
  readonly currentTheme = this._themeMode.asReadonly();
  
  /**
   * Current theme colors signal
   */
  readonly currentColors = this._themeColors.asReadonly();
  
  /**
   * Whether dynamic theming is active
   */
  readonly isDynamicTheme = this._isDynamicTheme.asReadonly();
  
  /**
   * User's custom color overrides
   */
  readonly customColors = this._customColors.asReadonly();

  /**
   * Admin-configured platform default colors (fallback when no content theme
   * is active)
   */
  readonly platformColors = this._platformColors.asReadonly();

  // ==========================================================================
  // COMPUTED SIGNALS
  // ==========================================================================
  
  /**
   * Whether dark mode is currently active
   */
  readonly isDarkMode = computed(() => {
    const mode = this._themeMode();
    if (mode === 'auto') {
      return this.prefersDarkMode();
    }
    return mode === 'dark';
  });

  /**
   * Whether light mode is currently active
   */
  readonly isLightMode = computed(() => !this.isDarkMode());

  /**
   * System dark mode preference
   */
  readonly prefersDarkMode = signal<boolean>(true);

  /**
   * Current background color (for dynamic backgrounds)
   */
  readonly backgroundColor = computed(() => {
    if (this._isDynamicTheme()) {
      return this._themeColors().background || this._themeColors().primary;
    }
    return this.isDarkMode() ? TEXT_ON_DARK : TEXT_ON_LIGHT;
  });

  // ==========================================================================
  // CONSTRUCTOR & INITIALIZATION
  // ==========================================================================
  
  constructor() {
    // Initialize system preference detection
    this.initializeSystemPreference();
    
    // Load saved theme preference
    this.loadThemePreference();
    
    // Listen for system preference changes
    this.setupSystemPreferenceListener();
    
    // Apply theme on changes
    effect(() => {
      this.applyTheme();
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================
  
  /**
   * Toggle between dark and light mode
   * 
   * @returns The new theme mode
   */
  toggleTheme(): ThemeMode {
    const newMode = this.isDarkMode() ? 'light' : 'dark';
    this.setTheme(newMode);
    return newMode;
  }

  /**
   * Set specific theme mode
   * 
   * @param mode - Theme mode to set ('dark', 'light', or 'auto')
   */
  setTheme(mode: ThemeMode): void {
    this._themeMode.set(mode);
    this._isDynamicTheme.set(false);
    this.saveThemePreference();
  }

  /**
   * Load theme colors from Firestore with inheritance chain
   * Priority: song → album → artist → platform defaults
   * 
   * @param songId - Optional song ID
   * @param albumId - Optional album ID
   * @param artistId - Optional artist ID
   */
  async loadThemeColors(
    songId?: string,
    albumId?: string,
    artistId?: string
  ): Promise<void> {
    try {
      // Follow inheritance chain: song → album → artist → defaults
      let colors: ThemeColors | null = null;
      
      // Try song-level colors
      if (songId) {
        colors = await this.loadColorsFromCollection('songs', songId);
      }
      
      // Fallback to album-level colors
      if (!colors && albumId) {
        colors = await this.loadColorsFromCollection('albums', albumId);
      }
      
      // Fallback to artist-level colors
      if (!colors && artistId) {
        colors = await this.loadColorsFromCollection('artists', artistId);
      }
      
      // Apply colors or use defaults
      if (colors) {
        this._themeColors.set(colors);
        this._isDynamicTheme.set(true);
        this.applyDynamicColors(colors);
      } else {
        this._isDynamicTheme.set(false);
      }
    } catch (error) {
      console.error('Failed to load theme colors:', error);
      // Fallback to defaults
      this._isDynamicTheme.set(false);
    }
  }

  /**
   * Set custom color overrides
   * 
   * @param colors - Partial color palette to override
   */
  setCustomColors(colors: Partial<ThemeColors>): void {
    this._customColors.set(colors);
    this.saveThemePreference();
  }

  /**
   * Set admin-configured platform default colors.
   * 
   * Applied whenever no song/album/artist theme is active. The reactive theme
   * effect re-applies the resolved palette to the CSS custom properties.
   * 
   * @param colors - Platform color palette
   */
  setPlatformColors(colors: ThemeColors): void {
    this._platformColors.set(normalizePalette(colors));
  }

  /**
   * Reset to default theme (no custom colors, no dynamic theme)
   */
  resetToDefault(): void {
    this._themeMode.set('dark');
    this._themeColors.set(DEFAULT_PLATFORM_COLORS);
    this._isDynamicTheme.set(false);
    this._customColors.set({});
    this.saveThemePreference();
  }

  /**
   * Get current theme mode
   */
  getCurrentTheme(): ThemeMode {
    return this._themeMode();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================
  
  /**
   * Load colors from a Firestore collection
   * 
   * @param collection - Collection name (artists, albums, songs)
   * @param id - Document ID
   * @returns Theme colors or null if not found
   */
  private async loadColorsFromCollection(
    collection: string,
    id: string
  ): Promise<ThemeColors | null> {
    try {
      const docRef = doc(this.firestore, collection, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const themeColors = data['themeColors'] as ThemeColors | undefined;
        
        if (themeColors && this.validateThemeColors(themeColors)) {
          return normalizePalette(themeColors);
        }
      }
    } catch (error) {
      console.error(`Failed to load colors from ${collection}/${id}:`, error);
    }
    
    return null;
  }

  /**
   * Validate theme colors meet WCAG AA standards.
   * 
   * Accepts partial palettes read from Firestore — legacy documents may only
   * carry primary/secondary/accent (the third hue was renamed to `tertiary`).
   * Foreground and container fields are validated when present and defaulted
   * by `normalizePalette()` otherwise.
   * 
   * @param colors - Theme colors to validate
   * @returns Whether colors are valid
   */
  private validateThemeColors(colors: Partial<ThemeColors>): boolean {
    // Legacy documents stored the tertiary hue under `accent`.
    const legacy = colors as Partial<ThemeColors> & { accent?: string };
    const tertiary = colors.tertiary ?? legacy.accent;

    // Basic validation - ensure required fields exist
    if (!colors.primary || !colors.secondary || !tertiary) {
      return false;
    }

    // Validate hex format
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (
      !hexRegex.test(colors.primary) ||
      !hexRegex.test(colors.secondary) ||
      !hexRegex.test(tertiary)
    ) {
      return false;
    }

    // Optional foreground/container colors must be valid hex when present.
    const optionalColors = [
      colors.foregroundPrimary,
      colors.foregroundSecondary,
      colors.foregroundTertiary,
      colors.containerPrimary,
      colors.containerSecondary,
      colors.containerTertiary,
    ] as const;

    if (optionalColors.some((color) => color !== undefined && !hexRegex.test(color))) {
      return false;
    }

    // Validate contrast if background is provided
    if (colors.background) {
      const textOnBg = getAccessibleTextColor(colors.background);
      const contrast = getContrastRatio(textOnBg, colors.background);
      
      // WCAG AA requires 4.5:1 for normal text
      if (contrast < 4.5) {
        console.warn('Theme colors do not meet WCAG AA standards');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Initialize system dark mode preference detection
   */
  private initializeSystemPreference(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.prefersDarkMode.set(darkModeQuery.matches);
    }
  }

  /**
   * Setup listener for system preference changes
   */
  private setupSystemPreferenceListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      darkModeQuery.addEventListener('change', (event) => {
        this.prefersDarkMode.set(event.matches);
        
        // If in auto mode, reapply theme
        if (this._themeMode() === 'auto') {
          this.applyTheme();
        }
      });
    }
  }

  /**
   * Apply current theme to document
   */
  private applyTheme(): void {
    const isDark = this.isDarkMode();
    const theme = isDark ? 'dark' : 'light';

    // Set data-theme attribute on document element
    if (this.document.documentElement) {
      this.document.documentElement.setAttribute('data-theme', theme);

      // Write the resolved palette onto the design tokens so buttons, links,
      // focus rings, and semantic states all follow platform/artist colors.
      this.applyBrandColors(this.resolvePalette());
    }
  }

  /**
   * Resolve the active color palette.
   * 
   * Content themes (song → album → artist) take priority; otherwise the
   * admin-configured platform palette (or its static defaults) applies.
   * 
   * @returns The active palette
   */
  private resolvePalette(): ThemeColors {
    return this._isDynamicTheme() ? this._themeColors() : this._platformColors();
  }

  /**
   * Apply dynamic colors from theme palette
   * 
   * @param colors - Theme colors to apply
   */
  private applyDynamicColors(colors: ThemeColors): void {
    if (this.document.documentElement) {
      this.document.documentElement.setAttribute('data-dynamic-theme', 'true');
      this.applyBrandColors(colors);
    }
  }

  /**
   * Write a color palette onto the application's CSS custom properties.
   * 
   * Maps each brand hue to its semantic design tokens:
   * - primary/secondary/tertiary  → --accent-primary/secondary/tertiary
   * - tertiary                    → --color-error (danger semantic)
   * - foregroundPrimary/Secondary/Tertiary → --text-on-accent/secondary/tertiary
   * - containerPrimary/Secondary/Tertiary  → --bg-container-* with derived
   *   --text-on-container-* text (WCAG luminance)
   * Plus the dynamic background tokens and the Material M3 system tokens so
   * both the hand-rolled components and Material components follow the palette.
   * 
   * @param colors - Palette to apply
   */
  private applyBrandColors(colors: ThemeColors): void {
    const el = this.document.documentElement;

    if (!el) {
      return;
    }

    // Resolve against the platform defaults so every optional foreground and
    // container field has a hex to apply (normalizePalette guarantees this,
    // but keep the fallback here for defensive safety).
    const resolved = { ...DEFAULT_PLATFORM_COLORS, ...colors } as Required<ThemeColors>;

    // Base hues
    el.style.setProperty('--accent-primary', resolved.primary);
    el.style.setProperty('--accent-secondary', resolved.secondary);
    el.style.setProperty('--accent-tertiary', resolved.tertiary);
    el.style.setProperty('--color-error', resolved.tertiary);
    el.style.setProperty('--border-focus', resolved.primary);

    // Foreground (text) colors
    el.style.setProperty('--text-on-accent', resolved.foregroundPrimary);
    el.style.setProperty('--text-on-secondary', resolved.foregroundSecondary);
    el.style.setProperty('--text-on-tertiary', resolved.foregroundTertiary);
    el.style.setProperty('--text-on-danger', resolved.foregroundTertiary);

    // Container (tinted surface) colors + derived on-container text
    const containers: readonly (readonly [string, string])[] = [
      ['primary', resolved.containerPrimary],
      ['secondary', resolved.containerSecondary],
      ['tertiary', resolved.containerTertiary],
    ];
    for (const [name, color] of containers) {
      el.style.setProperty(`--bg-container-${name}`, color);
      el.style.setProperty(`--text-on-container-${name}`, getAccessibleTextColor(color));
    }

    // Dynamic background tokens consumed by context-aware surfaces.
    el.style.setProperty('--bg-dynamic-primary', resolved.primary);
    el.style.setProperty('--bg-dynamic-secondary', resolved.secondary);
    el.style.setProperty('--bg-dynamic-accent', resolved.tertiary);

    el.style.setProperty('--bg-dynamic-background', resolved.background);

    // Material M3 system tokens so Material components inherit the palette.
    const materialTokens: readonly (readonly [string, string])[] = [
      ['--mat-sys-primary', resolved.primary],
      ['--mat-sys-on-primary', resolved.foregroundPrimary],
      ['--mat-sys-primary-container', resolved.containerPrimary],
      ['--mat-sys-on-primary-container', getAccessibleTextColor(resolved.containerPrimary)],
      ['--mat-sys-secondary', resolved.secondary],
      ['--mat-sys-on-secondary', resolved.foregroundSecondary],
      ['--mat-sys-secondary-container', resolved.containerSecondary],
      ['--mat-sys-on-secondary-container', getAccessibleTextColor(resolved.containerSecondary)],
      ['--mat-sys-tertiary', resolved.tertiary],
      ['--mat-sys-on-tertiary', resolved.foregroundTertiary],
      ['--mat-sys-tertiary-container', resolved.containerTertiary],
      ['--mat-sys-on-tertiary-container', getAccessibleTextColor(resolved.containerTertiary)],
      ['--mat-sys-error', resolved.tertiary],
      ['--mat-sys-on-error', resolved.foregroundTertiary],
      ['--mat-sys-error-container', resolved.containerTertiary],
      ['--mat-sys-on-error-container', getAccessibleTextColor(resolved.containerTertiary)],
    ];
    for (const [token, value] of materialTokens) {
      el.style.setProperty(token, value);
    }
  }

  /**
   * Load theme preference from Firestore or localStorage
   */
  private async loadThemePreference(): Promise<void> {
    try {
      // Try to load from Firestore if user is authenticated
      const user = await this.authService.currentUser();
      if (user) {
        await this.loadFromFirestore(user.userId);
        return;
      }
    } catch {
      console.warn('Failed to load theme from Firestore, falling back to localStorage');
    }
    
    // Fallback to localStorage
    this.loadFromLocalStorage();
  }
  
  /**
   * Save theme preference to Firestore or localStorage
   */
  private async saveThemePreference(): Promise<void> {
    const preference: ThemePreference = {
      mode: this._themeMode(),
      customColors: this._customColors() as ThemePreference['customColors'],
      updatedAt: new Date().toISOString(),
    };
    
    try {
      // Try to save to Firestore if user is authenticated
      const user = await this.authService.currentUser();
      if (user) {
        await this.saveToFirestore(user.userId, preference);
        return;
      }
    } catch {
      console.warn('Failed to save theme to Firestore, falling back to localStorage');
    }
    
    // Fallback to localStorage
    this.saveToLocalStorage(preference);
  }

  /**
   * Load theme preference from Firestore
   * 
   * @param userId - Public application user ID
   */
  private async loadFromFirestore(userId: string): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const preference = userData['themePreference'] as ThemePreference | undefined;
        
        if (preference) {
          this._themeMode.set(preference.mode);
          
          if (preference.customColors) {
            this._customColors.set(preference.customColors);
          }
          
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load theme preference from Firestore:', error);
    }
    
    // Fallback to localStorage if Firestore fails
    this.loadFromLocalStorage();
  }

  /**
   * Load theme preference from localStorage
   */
  private loadFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    try {
      const savedTheme = localStorage.getItem('themeMode') as ThemeMode | null;
      if (savedTheme && ['dark', 'light', 'auto'].includes(savedTheme)) {
        this._themeMode.set(savedTheme);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }

  /**
   * Save theme preference to Firestore
   * 
   * @param userId - Public application user ID
   * @param preference - Theme preference to save
   */
  private async saveToFirestore(userId: string, preference: ThemePreference): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      await updateDoc(userDocRef, {
        themePreference: preference,
      });
    } catch (error) {
      console.error('Failed to save theme preference to Firestore:', error);
      // Fallback to localStorage
      this.saveToLocalStorage(preference);
    }
  }

  /**
   * Save theme preference to localStorage
   * 
   * @param preference - Theme preference to save
   */
  private saveToLocalStorage(preference: ThemePreference): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    try {
      localStorage.setItem('themeMode', preference.mode);
      
      if (preference.customColors) {
        localStorage.setItem('themeCustomColors', JSON.stringify(preference.customColors));
      }
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }

}
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
import { Firestore } from '@angular/fire/firestore';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { AuthService } from './auth.service';

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
    accent?: string;
  };
  updatedAt: string;
}

/**
 * Theme colors structure for artists/albums/songs
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background?: string;
}

/**
 * Default platform colors
 */
const DEFAULT_COLORS: ThemeColors = {
  primary: '#ffb800',
  secondary: '#00a86b',
  accent: '#e63946',
  background: '#000000',
};

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
  private readonly _themeColors = signal<ThemeColors>(DEFAULT_COLORS);
  
  /**
   * Whether dynamic theming is active
   */
  private readonly _isDynamicTheme = signal<boolean>(false);
  
  /**
   * User's custom color overrides (if any)
   */
  private readonly _customColors = signal<Partial<ThemeColors>>({});

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
    return this.isDarkMode() ? '#000000' : '#ffffff';
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
   * Reset to default theme (no custom colors, no dynamic theme)
   */
  resetToDefault(): void {
    this._themeMode.set('dark');
    this._themeColors.set(DEFAULT_COLORS);
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
          return themeColors;
        }
      }
    } catch (error) {
      console.error(`Failed to load colors from ${collection}/${id}:`, error);
    }
    
    return null;
  }

  /**
   * Validate theme colors meet WCAG AA standards
   * 
   * @param colors - Theme colors to validate
   * @returns Whether colors are valid
   */
  private validateThemeColors(colors: ThemeColors): boolean {
    // Basic validation - ensure required fields exist
    if (!colors.primary || !colors.secondary || !colors.accent) {
      return false;
    }
    
    // Validate hex format
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(colors.primary) || 
        !hexRegex.test(colors.secondary) || 
        !hexRegex.test(colors.accent)) {
      return false;
    }
    
    // Validate contrast if background is provided
    if (colors.background) {
      const textOnBg = this.getAccessibleTextColor(colors.background);
      const contrast = this.getContrastRatio(textOnBg, colors.background);
      
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
    }
  }

  /**
   * Apply dynamic colors from theme palette
   * 
   * @param colors - Theme colors to apply
   */
  private applyDynamicColors(colors: ThemeColors): void {
    if (this.document.documentElement) {
      this.document.documentElement.setAttribute('data-dynamic-theme', 'true');
      
      // Set CSS custom properties for dynamic colors
      this.document.documentElement.style.setProperty('--bg-dynamic-primary', colors.primary);
      this.document.documentElement.style.setProperty('--bg-dynamic-secondary', colors.secondary);
      this.document.documentElement.style.setProperty('--bg-dynamic-accent', colors.accent);
      
      if (colors.background) {
        this.document.documentElement.style.setProperty('--bg-dynamic-background', colors.background);
      }
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
        await this.loadFromFirestore(user.uid);
        return;
      }
    } catch (error) {
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
        await this.saveToFirestore(user.uid, preference);
        return;
      }
    } catch (error) {
      console.warn('Failed to save theme to Firestore, falling back to localStorage');
    }
    
    // Fallback to localStorage
    this.saveToLocalStorage(preference);
  }

  /**
   * Load theme preference from Firestore
   * 
   * @param userId - Firebase user ID
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
   * @param userId - Firebase user ID
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

  // ==========================================================================
  // WCAG UTILITY METHODS (re-exported from color-extractor)
  // ==========================================================================
  
  /**
   * Calculate contrast ratio between two colors
   */
  private getContrastRatio(foreground: string, background: string): number {
    const lum1 = this.getRelativeLuminance(foreground);
    const lum2 = this.getRelativeLuminance(background);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calculate relative luminance of a color
   */
  private getRelativeLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);
    
    if (!rgb) {
      return 0;
    }
    
    const { r, g, b } = rgb;
    
    const normalize = (c: number) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    
    return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }

  /**
   * Get accessible text color for a given background
   */
  private getAccessibleTextColor(backgroundColor: string): string {
    const luminance = this.getRelativeLuminance(backgroundColor);
    
    return luminance > 0.179 ? '#000000' : '#ffffff';
  }
}
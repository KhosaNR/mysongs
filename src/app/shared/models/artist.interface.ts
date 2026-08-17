/**
 * Represents an artist profile in the My Songs platform.
 * 
 * @interface Artist
 * @example
 * ```typescript
 * const artist: Artist = {
 *   artistId: 'artist_01',
 *   name: 'Test Artist',
 *   bio: 'South African hip-hop/rap artist from Limpopo.',
 *   country: 'South Africa',
 *   genre: 'Hip-Hop/Rap',
 *   socials: {
 *     instagram: 'https://instagram.com/artisthandle'
 *   },
 *   themeColors: {
 *     primary: '#C5FCFB',
 *     secondary: '#2EF8FF',
 *     tertiary: '#e63946',
 *     foregroundPrimary: '#000000',
 *     foregroundSecondary: '#000000',
 *     foregroundTertiary: '#000000',
 *     containerPrimary: '#1E2626',
 *     containerSecondary: '#072526',
 *     containerTertiary: '#23090B',
 *     background: '#000000'
 *   }
 * };
 * ```
 */

/**
 * Theme colors for artist/album/song branding.
 * All colors must be valid 6-digit hex codes (e.g., '#C5FCFB').
 * 
 * Each brand hue (primary/secondary/tertiary) carries a matching foreground
 * (text) color and a container (tinted surface) color, mirroring the Material
 * M3 color roles. Missing fields are defaulted by ThemeService so legacy
 * documents (which stored the third hue as `accent`) keep working.
 */
export interface ThemeColors {
  /**
   * Primary brand color (used for accents, highlights).
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly primary: string;

  /**
   * Secondary brand color (used for gradients, secondary elements).
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly secondary: string;

  /**
   * Tertiary brand color (used for CTAs, important elements).
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly tertiary: string;

  /**
   * Foreground (text) color rendered on top of the primary hue.
   * Optional — omitted values fall back to the platform defaults.
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly foregroundPrimary?: string;

  /**
   * Foreground (text) color rendered on top of the secondary hue.
   * Optional — omitted values fall back to the platform defaults.
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly foregroundSecondary?: string;

  /**
   * Foreground (text) color rendered on top of the tertiary hue.
   * Optional — omitted values fall back to the platform defaults.
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly foregroundTertiary?: string;

  /**
   * Container (tinted surface) color for the primary hue.
   * Optional — omitted values fall back to the platform defaults.
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly containerPrimary?: string;

  /**
   * Container (tinted surface) color for the secondary hue.
   * Optional — omitted values fall back to the platform defaults.
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly containerSecondary?: string;

  /**
   * Container (tinted surface) color for the tertiary hue.
   * Optional — omitted values fall back to the platform defaults.
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly containerTertiary?: string;

  /**
   * Background color (optional, defaults to platform background).
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly background?: string;
}

export interface Artist {
  /**
   * Unique opaque identifier for the artist (e.g., 'art_AbCd123456...').
   * @format slug
   */
  readonly artistId: string;

  /**
   * Public user ID of the account that owns this artist profile
   * (links to `users/{userId}`).
   * @format slug
   */
  readonly userId?: string;

  /**
   * Moderation state of the artist profile.
   * @default 'pending'
   */
  readonly artistStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  /**
   * Display name of the artist or band.
   * @minLength 1
   * @maxLength 100
   */
  readonly name: string;

  /**
   * Biography or description of the artist.
   * @maxLength 2000
   */
  readonly bio?: string;

  /**
   * Country of origin for the artist.
   * @maxLength 100
   */
  readonly country?: string;

  /**
   * Primary music genre or category.
   * @maxLength 50
   */
  readonly genre?: string;

  /**
   * Social media profile links.
   */
  readonly socials?: ArtistSocials;

  /**
   * Array of sponsor information.
   * @maxItems 10
   */
  readonly sponsors?: readonly Sponsor[];

  /**
   * URL to the artist's profile image.
   * @format uri
   */
  readonly photoURL?: string;

  /**
   * Artist brand colors for dynamic theming.
   * Inherited by albums and songs if not overridden.
   */
  readonly themeColors?: ThemeColors;

  /**
   * Timestamp when the artist profile was created.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the artist profile was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;

  /**
   * Soft deletion flag. When true, the artist is hidden from public views.
   * @default false
   */
  readonly isDeleted?: boolean;

  /**
   * Timestamp when the artist was soft-deleted.
   * @format date-time
   */
  readonly deletedAt?: Date;
}

/**
 * Social media profile links for an artist.
 */
export interface ArtistSocials {
  /**
   * Facebook profile URL.
   * @format uri
   */
  readonly facebook?: string;

  /**
   * Instagram profile URL.
   * @format uri
   */
  readonly instagram?: string;

  /**
   * Twitter/X profile URL.
   * @format uri
   */
  readonly twitter?: string;

  /**
   * YouTube channel URL.
   * @format uri
   */
  readonly youtube?: string;

  /**
   * Spotify artist profile URL.
   * @format uri
   */
  readonly spotify?: string;

  /**
   * Apple Music artist profile URL.
   * @format uri
   */
  readonly appleMusic?: string;

  /**
   * Official website URL.
   * @format uri
   */
  readonly website?: string;
}

/**
 * Represents a sponsor associated with an artist.
 */
export interface Sponsor {
  /**
   * Name of the sponsor or brand.
   * @minLength 1
   * @maxLength 100
   */
  readonly name: string;

  /**
   * URL to the sponsor's logo image.
   * @format uri
   */
  readonly logoUrl: string;

  /**
   * URL to the sponsor's website.
   * @format uri
   */
  readonly websiteUrl?: string;
}
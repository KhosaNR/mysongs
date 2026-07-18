/**
 * Represents an artist profile in the Leo Bee Music platform.
 * 
 * @interface Artist
 * @example
 * ```typescript
 * const artist: Artist = {
 *   artistId: 'leobee_01',
 *   name: 'Leo Bee',
 *   bio: 'South African hip-hop/rap artist from Limpopo.',
 *   country: 'South Africa',
 *   genre: 'Hip-Hop/Rap',
 *   socials: {
 *     instagram: 'https://instagram.com/leobeemusic'
 *   },
 *   themeColors: {
 *     primary: '#ffb800',
 *     secondary: '#00a86b',
 *     accent: '#e63946',
 *     background: '#000000'
 *   }
 * };
 * ```
 */

/**
 * Theme colors for artist/album/song branding.
 * All colors must be valid 6-digit hex codes (e.g., '#ffb800').
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
   * Accent color (used for CTAs, important elements).
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly accent: string;

  /**
   * Background color (optional, defaults to platform background).
   * @pattern ^#[0-9A-F]{6}$
   */
  readonly background?: string;
}

export interface Artist {
  /**
   * Unique identifier for the artist (e.g., 'leobee_01').
   * @format uuid
   */
  readonly artistId: string;

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
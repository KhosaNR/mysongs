/**
 * Represents an album in the Leo Bee Music platform.
 * 
 * @interface Album
 * @example
 * ```typescript
 * const album: Album = {
 *   albumId: 'album_01',
 *   artistId: 'leobee_01',
 *   title: 'Langha Mbilu',
 *   genre: 'Hip-Hop/Rap',
 *   country: 'South Africa',
 *   releaseDate: new Date('2020-01-01'),
 *   artworkUrl: 'https://pub-r2.dev/albums/album_01.jpg',
 *   themeColors: {
 *     primary: '#ffb800',
 *     secondary: '#00a86b',
 *     accent: '#e63946',
 *     background: '#1a1a2e'
 *   },
 *   trackCount: 12
 * };
 * ```
 */

import { ThemeColors } from './artist.interface';

/**
 * Represents an album or EP release.
 */
export interface Album {
  /**
   * Unique identifier for the album (e.g., 'album_01').
   * @format uuid
   */
  readonly albumId: string;

  /**
   * Reference to the artist who created this album.
   * @format uuid
   */
  readonly artistId: string;

  /**
   * Title of the album.
   * @minLength 1
   * @maxLength 200
   */
  readonly title: string;

  /**
   * Music genre or category for the album.
   * @maxLength 50
   */
  readonly genre?: string;

  /**
   * Country of origin for the album.
   * @maxLength 100
   */
  readonly country?: string;

  /**
   * Release date of the album.
   * @format date-time
   */
  readonly releaseDate?: Date;

  /**
   * URL to the album artwork image.
   * Uploaded by the artist when they update their profile.
   * @format uri
   */
  readonly artworkUrl?: string;

  /**
   * Album brand colors for dynamic theming.
   * Inherited by songs if not overridden at the song level.
   * Overrides artist-level theme colors when an album is active.
   */
  readonly themeColors?: ThemeColors;

  /**
   * Number of tracks in the album.
   * @minimum 1
   * @maximum 50
   */
  readonly trackCount?: number;

  /**
   * Credits for the album (writers, producers, engineers).
   */
  readonly credits?: AlbumCredits;

  /**
   * Timestamp when the album was created in the system.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the album was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;
}

/**
 * Credits for an album or song.
 */
export interface AlbumCredits {
  /**
   * Writer(s) of the album/song.
   * @maxLength 500
   */
  readonly writtenBy?: string;

  /**
   * Producer(s) of the album/song.
   * @maxLength 500
   */
  readonly producedBy?: string;

  /**
   * Mixing and mastering engineer(s).
   * @maxLength 500
   */
  readonly mixedMasteredBy?: string;
}
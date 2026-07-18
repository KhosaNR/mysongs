/**
 * Represents a song/track in the Leo Bee Music platform.
 * 
 * @interface Song
 * @example
 * ```typescript
 * const song: Song = {
 *   songId: 'track_001',
 *   artistId: 'leobee_01',
 *   title: 'Your Love feat Hopey B',
 *   albumId: 'langha_mbilu',
 *   trackNumber: 1,
 *   streamUrl: 'https://pub-r2.dev/stream/track_001.mp3',
 *   securePath: 'secure_audio/track_001_320.mp3',
 *   priceZAR: 5.00,
 *   isTopSong: true,
 *   duration: 245,
 *   genre: 'Hip-Hop/Rap',
 *   credits: {
 *     writtenBy: 'Bongani Mbhiza',
 *     producedBy: 'Mr Ny',
 *     mixedMasteredBy: 'Clein Buoy'
 *   },
 *   lyrics: 'Your love is all I need...'
 * };
 * ```
 */

import { ThemeColors } from './artist.interface';

export interface Song {
  /**
   * Unique identifier for the song (e.g., 'track_001').
   * @format uuid
   */
  readonly songId: string;

  /**
   * Reference to the artist who created this song.
   * @format uuid
   */
  readonly artistId: string;

  /**
   * Title of the song.
   * @minLength 1
   * @maxLength 200
   */
  readonly title: string;

  /**
   * Reference to the album this song belongs to (optional for singles).
   * @format uuid
   */
  readonly albumId?: string;

  /**
   * Track number within the album.
   * @minimum 1
   * @maximum 100
   */
  readonly trackNumber?: number;

  /**
   * Public streaming URL (128kbps preview).
   * @format uri
   */
  readonly streamUrl: string;

  /**
   * Secure path in R2 storage for high-fidelity download (320kbps).
   * @format uri
   */
  readonly securePath: string;

  /**
   * Price in South African Rand for full track download.
   * @minimum 0
   * @maximum 1000
   */
  readonly priceZAR: number;

  /**
   * Whether this song is featured as a top song.
   * @default false
   */
  readonly isTopSong?: boolean;

  /**
   * Duration of the song in seconds.
   * @minimum 1
   * @maximum 600
   */
  readonly duration?: number;

  /**
   * Music genre or category.
   * @maxLength 50
   */
  readonly genre?: string;

  /**
   * Full lyrics text with optional annotations.
   */
  readonly lyrics?: string;

  /**
   * Interactive annotations for specific lyric sections.
   * @maxItems 50
   */
  readonly annotations?: readonly LyricAnnotation[];

  /**
   * Song brand colors for dynamic theming.
   * Overrides album-level and artist-level theme colors when active.
   * Highest priority in the inheritance chain: song -> album -> artist -> platform defaults.
   */
  readonly themeColors?: ThemeColors;

  /**
   * URL to the album artwork image.
   * Uploaded by the artist when they update their profile.
   * @format uri
   */
  readonly artworkUrl?: string;

  /**
   * Array of tags for search and categorization.
   * @maxItems 20
   */
  readonly tags?: readonly string[];

  /**
   * Number of times this song has been streamed.
   * @minimum 0
   */
  readonly streamCount?: number;

  /**
   * Number of times this song has been purchased.
   * @minimum 0
   */
  readonly purchaseCount?: number;

  /**
   * Credits for the song (writers, producers, engineers).
   */
  readonly credits?: SongCredits;

  /**
   * Timestamp when the song was released.
   * @format date-time
   */
  readonly releaseDate?: Date;

  /**
   * Timestamp when the song was created in the system.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the song was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;
}

/**
 * Represents an interactive annotation within song lyrics.
 */
export interface LyricAnnotation {
  /**
   * Start position in the lyrics text (character index).
   * @minimum 0
   */
  readonly start: number;

  /**
   * End position in the lyrics text (character index).
   * @minimum 0
   */
  readonly end: number;

  /**
   * Annotation text content (background story, meaning, etc.).
   * @maxLength 500
   */
  readonly text: string;

  /**
   * Optional title for the annotation.
   * @maxLength 100
   */
  readonly title?: string;
}

/**
 * Credits for a song (writers, producers, engineers).
 */
export interface SongCredits {
  /**
   * Writer(s) of the song.
   * @maxLength 500
   */
  readonly writtenBy?: string;

  /**
   * Producer(s) of the song.
   * @maxLength 500
   */
  readonly producedBy?: string;

  /**
   * Mixing and mastering engineer(s).
   * @maxLength 500
   */
  readonly mixedMasteredBy?: string;
}
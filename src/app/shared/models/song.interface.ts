/**
 * Represents a song/track in the My Songs platform.
 * 
 * @interface Song
 * @example
 * ```typescript
 * const song: Song = {
 *   songId: 'track_001',
 *   artistId: 'artist_01',
 *   title: 'Your Love feat Hopey B',
 *   albumId: 'langha_mbilu',
 *   trackNumber: 1,
 *   streamUrl: 'https://pub-r2.dev/stream/track_001.mp3',
 *   securePath: 'secure_audio/track_001_320.mp3',
 *   priceZAR: 5.00,
 *   isTopSong: true,
 *   duration: 245,
 *   genre: 'Hip-Hop/Rap',
 *   writtenBy: 'Bongani Mbhiza',
 *   featuredArtists: 'Hopey.B',
 *   producers: 'Mr Ny',
 *   lyrics: 'Your love is all I need...'
 * };
 * ```
 */

import { ThemeColors } from './artist.interface';

export interface Song {
  readonly songId: string;
  readonly artistId: string;
  readonly title: string;
  readonly featuredArtists?: string;
  readonly producers?: string;
  readonly writtenBy?: string;
  readonly albumId?: string;
  readonly trackNumber?: number;
  readonly streamUrl: string;
  readonly securePath: string;
  readonly priceZAR: number;
  /**
   * Minimum price (ZAR) a buyer may pay for this song. When unset (or ≤ 0)
   * the purchase dialog's floor is the standard `priceZAR`.
   */
  readonly minimumPriceZAR?: number;
  readonly isTopSong?: boolean;
  readonly duration?: number;
  readonly genre?: string;
  readonly lyrics?: string;
  readonly annotations?: readonly LyricAnnotation[];
  readonly themeColors?: ThemeColors;
  readonly artworkUrl?: string;
  readonly youtubeVideoId?: string;
  readonly tags?: readonly string[];
  readonly streamCount?: number;
  readonly purchaseCount?: number;
  readonly releaseDate?: Date;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly isDeleted?: boolean;
  readonly deletedAt?: Date;
}

export interface LyricAnnotation {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly title?: string;
}
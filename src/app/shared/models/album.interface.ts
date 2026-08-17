/**
 * Represents an album in the My Songs platform.
 */

import { ThemeColors } from './artist.interface';

export interface Album {
  readonly albumId: string;
  readonly artistId: string;
  readonly title: string;
  readonly genre?: string;
  readonly country?: string;
  readonly releaseDate?: Date;
  readonly artworkUrl?: string;
  readonly themeColors?: ThemeColors;
  readonly trackCount?: number;
  readonly credits?: AlbumCredits;
  /**
   * Standard price (ZAR) for the whole album. Hidden from purchase when
   * missing or ≤ 0.
   */
  readonly priceZAR?: number;
  /**
   * Minimum price (ZAR) a buyer may pay for this album. When unset (or ≤ 0)
   * the purchase dialog's floor is the standard `priceZAR`.
   */
  readonly minimumPriceZAR?: number;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly isDeleted?: boolean;
  readonly deletedAt?: Date;
}

export interface AlbumCredits {
  readonly writtenBy?: string;
  readonly producedBy?: string;
  readonly mixedMasteredBy?: string;
}

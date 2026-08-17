/**
 * Search result interfaces for the search feature.
 *
 * Provides type definitions for search data across artists, tracks, and lyrics.
 * Used by SearchService to structure Fuse.js search results.
 */
import { ThemeColors } from '../../../shared/models/artist.interface';

export interface ArtistSearchData {
  readonly artistId: string;
  readonly name: string;
  readonly bio: string;
  readonly themeColors?: ThemeColors;
}

export interface TrackSearchData {
  readonly songId: string;
  readonly title: string;
  readonly artistId: string;
  readonly artistName: string;
  readonly albumId?: string;
  readonly albumName?: string;
  readonly duration: number;
  readonly streamUrl: string;
  readonly securePath: string;
  readonly priceZAR: number;
  readonly artworkUrl?: string;
  readonly youtubeVideoId?: string;
}

export interface AlbumSearchData {
  readonly albumId: string;
  readonly title: string;
  readonly artistId: string;
  readonly artistName: string;
  readonly genre?: string;
  readonly artworkUrl?: string;
  readonly themeColors?: ThemeColors;
}

export interface LyricsSearchData {
  readonly songId: string;
  readonly title: string;
  readonly artistId: string;
  readonly artistName: string;
  readonly lyrics: string;
  readonly matchedSnippet: string;
}

export interface SearchResult<T> {
  readonly item: T;
  readonly score: number;
  readonly matches?: readonly FuseMatch[];
}

export interface FuseMatch {
  readonly indices: readonly [number, number][];
  readonly value?: string;
}

export type SearchResultItem =
  | { type: 'artist'; data: SearchResult<ArtistSearchData> }
  | { type: 'album'; data: SearchResult<AlbumSearchData> }
  | { type: 'track'; data: SearchResult<TrackSearchData> }
  | { type: 'lyrics'; data: SearchResult<LyricsSearchData> };
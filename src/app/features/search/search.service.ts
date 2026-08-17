/**
 * Search service with Fuse.js-powered fuzzy search.
 *
 * Provides typo-tolerant search across artists, tracks, and lyrics.
 * Uses Angular Signals for reactive state management.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import Fuse from 'fuse.js';
import type { IFuseOptions, FuseResult } from 'fuse.js';
import { DbService } from '../../core/services/db.service';
import { where } from '@angular/fire/firestore';
import { Artist } from '../../shared/models/artist.interface';
import { Album } from '../../shared/models/album.interface';
import { Song } from '../../shared/models/song.interface';
import {
  ArtistSearchData,
  AlbumSearchData,
  TrackSearchData,
  LyricsSearchData,
  SearchResultItem,
  FuseMatch,
} from './models/search-result.interface';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private readonly artists = signal<ArtistSearchData[]>([]);
  private readonly albums = signal<AlbumSearchData[]>([]);
  private readonly tracks = signal<TrackSearchData[]>([]);
  private readonly lyrics = signal<LyricsSearchData[]>([]);
  private readonly isLoading = signal(false);
  private readonly searchQuery = signal('');

  readonly results = computed<SearchResultItem[]>(() => {
    const query = this.searchQuery().trim();
    if (!query) {
      return [];
    }

    const artistResults = this.searchArtists(query);
    const albumResults = this.searchAlbums(query);
    const trackResults = this.searchTracks(query);
    const lyricsResults = this.searchLyrics(query);

    return [...artistResults, ...albumResults, ...trackResults, ...lyricsResults].sort(
      (a, b) => a.data.score - b.data.score,
    );
  });

  readonly hasResults = computed(() => this.results().length > 0);
  readonly isSearching = computed(() => this.isLoading());
  readonly currentQuery = computed(() => this.searchQuery());

  private artistFuse: Fuse<ArtistSearchData> | null = null;
  private albumFuse: Fuse<AlbumSearchData> | null = null;
  private trackFuse: Fuse<TrackSearchData> | null = null;
  private lyricsFuse: Fuse<LyricsSearchData> | null = null;

  private readonly dbService = inject(DbService);

  /**
   * Initializes search data by loading artists, albums, and songs from
   * Firestore and resolving artist/album display names for joined results.
   *
   * @throws Error if any source collection fails to load
   */
  async initializeData(): Promise<void> {
    try {
      this.isLoading.set(true);
      const [artistsResult, albumsResult, songsResult] = await Promise.all([
        this.dbService.getCollection<Artist>('artists', {
          constraints: [where('isDeleted', '==', false)],
        }),
        this.dbService.getCollection<Album>('albums', {
          constraints: [where('isDeleted', '==', false)],
        }),
        this.dbService.getCollection<Song>('songs', {
          constraints: [where('isDeleted', '==', false)],
        }),
      ]);

      if (artistsResult.isFailure()) {
        throw new Error(`Failed to load artists: ${artistsResult.getError()}`);
      }

      if (albumsResult.isFailure()) {
        throw new Error(`Failed to load albums: ${albumsResult.getError()}`);
      }

      if (songsResult.isFailure()) {
        throw new Error(`Failed to load songs: ${songsResult.getError()}`);
      }

      const artists = artistsResult.getData();
      const albums = albumsResult.getData();
      const songs = songsResult.getData();

      const artistNames = new Map(
        artists.map((artist) => [artist.data.artistId, artist.data.name]),
      );
      const albumTitles = new Map(albums.map((album) => [album.id, album.data.title]));

      const artistData: ArtistSearchData[] = artists.map((artist) => ({
        artistId: artist.data.artistId || artist.id,
        name: artist.data.name,
        bio: artist.data.bio || '',
        themeColors: artist.data.themeColors,
      }));

      const albumData: AlbumSearchData[] = albums.map((album) => ({
        albumId: album.id,
        title: album.data.title,
        artistId: album.data.artistId,
        artistName: artistNames.get(album.data.artistId) || '',
        genre: album.data.genre,
        artworkUrl: album.data.artworkUrl,
        themeColors: album.data.themeColors,
      }));

      const trackData: TrackSearchData[] = songs.map((song) => ({
        songId: song.data.songId || song.id,
        title: song.data.title,
        artistId: song.data.artistId,
        artistName: artistNames.get(song.data.artistId) || '',
        albumId: song.data.albumId,
        albumName: song.data.albumId ? albumTitles.get(song.data.albumId) || '' : '',
        duration: song.data.duration || 0,
        streamUrl: song.data.streamUrl,
        securePath: song.data.securePath || '',
        priceZAR: song.data.priceZAR || 0,
        artworkUrl: song.data.artworkUrl,
      }));

      const lyricsData: LyricsSearchData[] = songs
        .filter((song) => song.data.lyrics && song.data.lyrics.trim().length > 0)
        .map((song) => ({
          songId: song.data.songId || song.id,
          title: song.data.title,
          artistId: song.data.artistId,
          artistName: artistNames.get(song.data.artistId) || '',
          lyrics: song.data.lyrics!,
          matchedSnippet: '',
        }));

      this.artists.set(artistData);
      this.albums.set(albumData);
      this.tracks.set(trackData);
      this.lyrics.set(lyricsData);

      this.initializeFuseInstances();
    } catch (error) {
      throw new Error(
        `Failed to initialize search data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  search(query: string): void {
    this.searchQuery.set(query);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  private initializeFuseInstances(): void {
    const artistOptions: IFuseOptions<ArtistSearchData> = {
      keys: ['name', 'bio'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
    };

    const albumOptions: IFuseOptions<AlbumSearchData> = {
      keys: ['title', 'artistName', 'genre'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
    };

    const trackOptions: IFuseOptions<TrackSearchData> = {
      keys: ['title', 'artistName', 'albumName'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
    };

    const lyricsOptions: IFuseOptions<LyricsSearchData> = {
      keys: ['lyrics'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 3,
    };

    this.artistFuse = new Fuse(this.artists(), artistOptions);
    this.albumFuse = new Fuse(this.albums(), albumOptions);
    this.trackFuse = new Fuse(this.tracks(), trackOptions);
    this.lyricsFuse = new Fuse(this.lyrics(), lyricsOptions);
  }

  private searchAlbums(query: string): SearchResultItem[] {
    if (!this.albumFuse || !query) {
      return [];
    }

    const results = this.albumFuse.search(query);
    return results.map((result: FuseResult<AlbumSearchData>) => ({
      type: 'album' as const,
      data: {
        item: result.item,
        score: result.score ?? 1,
        matches: result.matches as readonly FuseMatch[] | undefined,
      },
    }));
  }

  private searchArtists(query: string): SearchResultItem[] {
    if (!this.artistFuse || !query) {
      return [];
    }

    const results = this.artistFuse.search(query);
    return results.map((result: FuseResult<ArtistSearchData>) => ({
      type: 'artist' as const,
      data: {
        item: result.item,
        score: result.score ?? 1,
        matches: result.matches as readonly FuseMatch[] | undefined,
      },
    }));
  }

  private searchTracks(query: string): SearchResultItem[] {
    if (!this.trackFuse || !query) {
      return [];
    }

    const results = this.trackFuse.search(query);
    return results.map((result: FuseResult<TrackSearchData>) => ({
      type: 'track' as const,
      data: {
        item: result.item,
        score: result.score ?? 1,
        matches: result.matches as readonly FuseMatch[] | undefined,
      },
    }));
  }

  private searchLyrics(query: string): SearchResultItem[] {
    if (!this.lyricsFuse || !query) {
      return [];
    }

    const results = this.lyricsFuse.search(query);
    return results
      .map((result: FuseResult<LyricsSearchData>) => {
        const snippet = this.extractLyricsSnippet(result.item.lyrics, result.matches);
        return {
          type: 'lyrics' as const,
          data: {
            item: { ...result.item, matchedSnippet: snippet },
            score: result.score ?? 1,
            matches: result.matches as readonly FuseMatch[] | undefined,
          },
        };
      })
      .filter((result) => result.data.item.matchedSnippet.length > 0);
  }

  /**
   * Extracts a context snippet around the first match in lyrics.
   */
  private extractLyricsSnippet(lyrics: string, matches?: readonly FuseMatch[]): string {
    if (!matches || matches.length === 0) {
      return lyrics.substring(0, 150);
    }

    const firstMatch = matches[0];
    const matchStart = firstMatch.indices[0][0];
    const contextStart = Math.max(0, matchStart - 75);
    const contextEnd = Math.min(lyrics.length, matchStart + 150);

    let snippet = lyrics.substring(contextStart, contextEnd);
    if (contextStart > 0) {
      snippet = '...' + snippet;
    }
    if (contextEnd < lyrics.length) {
      snippet = snippet + '...';
    }

    return snippet;
  }
}

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { where } from '@angular/fire/firestore';
import { DbService } from '../../core/services/db.service';
import { ThemeService } from '../../core/services/theme.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { AuthService } from '../../core/services/auth.service';
import { Artist } from '../../shared/models/artist.interface';
import { Album } from '../../shared/models/album.interface';
import { Song } from '../../shared/models/song.interface';
import { Collection, CollectionWithId } from '../../shared/models/collection.interface';
import { CollectionService } from '../../core/services/collection.service';
import { songToTrack } from '../../core/utils/track-mapper';
import { USER_ROLE } from '../../core/constants/navigation.constants';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TrackRowComponent } from '../../shared/components/track-row/track-row.component';
import { SearchInputComponent } from '../../shared/components/search-input/search-input.component';
import { AddToPlaylistDialogComponent } from '../playlists/add-to-playlist-dialog.component';
import { AlbumFormDialogComponent, AlbumFormDialogData, AlbumFormDialogResult } from '../artist/album-management/album-form-dialog.component';
import {
  CollectionFormDialogComponent,
  CollectionFormDialogData,
  CollectionFormDialogResult,
} from '../artist/collection-management/collection-form-dialog.component';
import {
  SongFormDialogComponent,
  SongFormDialogData,
  SongFormDialogResult,
  SongWithId,
} from '../../shared/components/song-form-dialog/song-form-dialog.component';
import {
  ArtistFormDialogComponent,
  ArtistFormDialogResult,
  ArtistWithId,
} from '../../shared/components/artist-form-dialog/artist-form-dialog.component';

/** Album with its Firestore document ID. */
interface AlbumWithId extends Album {
  readonly id: string;
}

/** Social links flattened for the template. */
interface SocialLink {
  readonly label: string;
  readonly url: string;
}

/** Tab types for the artist catalog hub. */
type ArtistTab = 'albums' | 'songs' | 'singles' | 'videos' | 'lyrics' | 'collections';

/** Lower-cases and trims text for case-insensitive search matching. */
function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Public artist detail page: bio, socials, and a tabbed catalog hub
 * (Albums | Songs | Singles | Videos | Lyrics) with a single search field.
 * Owner artists and admins can edit content in place via dialogs.
 */
@Component({
  selector: 'app-artist-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
    EmptyStateComponent,
    TrackRowComponent,
    SearchInputComponent,
    AddToPlaylistDialogComponent,
  ],
  templateUrl: './artist-detail.component.html',
  styleUrl: './artist-detail.component.scss',
})
export class ArtistDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dbService = inject(DbService);
  private readonly themeService = inject(ThemeService);
  private readonly audioPlayerService = inject(AudioPlayerService);
  private readonly authService = inject(AuthService);
  private readonly collectionService = inject(CollectionService);
  private readonly dialog = inject(MatDialog);

  /** True when this instance renders the signed-in artist's own management hub (no `:artistId` param). */
  private readonly isSelfView = !this.route.snapshot.paramMap.has('artistId');

  readonly artist = signal<Artist | null>(null);
  readonly albums = signal<AlbumWithId[]>([]);
  readonly songs = signal<Song[]>([]);
  readonly collections = signal<CollectionWithId[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  /** Active catalog tab. */
  readonly activeTab = signal<ArtistTab>('albums');

  /** Single search field — filters whatever tab is active. */
  readonly searchQuery = signal('');

  /** Add-to-playlist dialog state. */
  readonly isPlaylistDialogOpen = signal(false);
  readonly playlistSongIds = signal<string[]>([]);

  readonly tabs: { key: ArtistTab; label: string }[] = [
    { key: 'albums', label: 'Albums' },
    { key: 'songs', label: 'Songs' },
    { key: 'singles', label: 'Singles' },
    { key: 'videos', label: 'Videos' },
    { key: 'lyrics', label: 'Lyrics' },
    { key: 'collections', label: 'Collections' },
  ];

  /** Social profile links (resolved from the artist doc). */
  readonly socials = computed<SocialLink[]>(() => {
    const socials = this.artist()?.socials;
    if (!socials) return [];
    const entries: [string, string | undefined][] = [
      ['Website', socials.website],
      ['Facebook', socials.facebook],
      ['Instagram', socials.instagram],
      ['Twitter / X', socials.twitter],
      ['YouTube', socials.youtube],
      ['Spotify', socials.spotify],
      ['Apple Music', socials.appleMusic],
    ];
    return entries
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([label, url]) => ({ label, url }));
  });

  /** Whether the current user may edit this artist's content (owner or admin). */
  readonly canEdit = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.role === USER_ROLE.ADMIN) return true;
    return user.role === USER_ROLE.ARTIST && !!user.artistId && user.artistId === this.artist()?.artistId;
  });


  /** Albums sorted by release date desc (year desc). */
  readonly sortedAlbums = computed(() => {
    return [...this.albums()].sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });
  });

  /** All songs sorted by release date desc. */
  readonly sortedSongs = computed(() => {
    return [...this.songs()].sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });
  });

  /** Singles — tracks that are not part of any album — sorted by release date desc. */
  readonly singles = computed(() => {
    return this.sortedSongs().filter((song) => !song.albumId);
  });

  /** Songs with YouTube videos, sorted by release date desc. */
  readonly videoSongs = computed(() => {
    return this.sortedSongs().filter((song) => !!song.youtubeVideoId);
  });

  /** Songs with lyrics, sorted by release date desc. */
  readonly lyricsSongs = computed(() => {
    return this.sortedSongs().filter((song) => !!song.lyrics && song.lyrics.trim().length > 0);
  });

  /**
   * Albums filtered by the search query: an album matches when its own title
   * matches or when any of this artist's tracks with that album matches.
   */
  readonly filteredAlbums = computed(() => {
    const query = normalizeText(this.searchQuery());
    const albums = this.sortedAlbums();
    if (!query) return albums;
    return albums.filter((album) => {
      if (normalizeText(album.title).includes(query)) return true;
      return this.songs().some(
        (song) => song.albumId === album.id && normalizeText(song.title).includes(query),
      );
    });
  });

  /**
   * All tracks filtered by the search query. Searching an album name returns
   * every track in that album; otherwise matching track titles are returned.
   */
  readonly filteredSongs = computed(() => {
    const query = normalizeText(this.searchQuery());
    const songs = this.sortedSongs();
    if (!query) return songs;

    const matchingAlbumIds = this.albums()
      .filter((album) => normalizeText(album.title).includes(query))
      .map((album) => album.id);
    if (matchingAlbumIds.length > 0) {
      return songs.filter((song) => song.albumId && matchingAlbumIds.includes(song.albumId));
    }
    return songs.filter((song) => normalizeText(song.title).includes(query));
  });

  /** Singles filtered by the search query. */
  readonly filteredSingles = computed(() => {
    const query = normalizeText(this.searchQuery());
    const singles = this.singles();
    if (!query) return singles;
    return singles.filter((song) => normalizeText(song.title).includes(query));
  });

  /** Videos filtered by the search query. */
  readonly filteredVideos = computed(() => {
    const query = normalizeText(this.searchQuery());
    const videos = this.videoSongs();
    if (!query) return videos;
    return videos.filter((song) => normalizeText(song.title).includes(query));
  });

  /** Lyrics filtered by the search query. */
  readonly filteredLyrics = computed(() => {
    const query = normalizeText(this.searchQuery());
    const lyrics = this.lyricsSongs();
    if (!query) return lyrics;
    return lyrics.filter((song) => normalizeText(song.title).includes(query));
  });

  /**
   * Collections filtered by the search query: a collection matches when its
   * own name matches or when any of its songs' titles matches.
   */
  readonly filteredCollections = computed(() => {
    const query = normalizeText(this.searchQuery());
    const collections = this.collections();
    if (!query) return collections;
    return collections.filter((collection) => {
      if (normalizeText(collection.name).includes(query)) return true;
      const songTitles = this.songs()
        .filter((song) => collection.songIds.includes(song.songId))
        .map((song) => normalizeText(song.title));
      return songTitles.some((title) => title.includes(query));
    });
  });

  constructor() {
    const initialTab = this.route.snapshot.data['tab'] as ArtistTab | undefined;
    if (initialTab) {
      this.activeTab.set(initialTab);
    }

    const artistId = this.route.snapshot.paramMap.get('artistId');
    if (artistId) {
      void this.load(artistId);
    } else {
      // Self mode — the artist management hub for the signed-in artist.
      const selfArtistId = this.authService.currentUser()?.artistId;
      if (selfArtistId) {
        void this.load(selfArtistId);
      } else {
        this.error.set('No artist ID assigned to this account.');
        this.isLoading.set(false);
      }
    }
  }

  /**
   * Loads the artist profile, albums, and songs, and applies the artist theme.
   *
   * @param artistId - Artist document ID
   */
  async load(artistId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const artistResult = await this.dbService.getDocument<Artist>('artists', artistId);
      if (artistResult.isFailure()) {
        this.error.set(artistResult.getError());
        return;
      }
      const artist = artistResult.getData().data;
      this.artist.set(artist);

      void this.themeService.loadThemeColors(undefined, undefined, artist.artistId);

      const [albumsResult, songsResult, collectionsResult] = await Promise.all([
        this.dbService.getCollection<Album>('albums', {
          constraints: [where('artistId', '==', artist.artistId), where('isDeleted', '==', false)],
        }),
        this.dbService.getCollection<Song>('songs', {
          constraints: [where('artistId', '==', artist.artistId), where('isDeleted', '==', false)],
        }),
        this.dbService.getCollection<Collection>('collections', {
          constraints: [where('artistId', '==', artist.artistId), where('isDeleted', '==', false)],
        }),
      ]);

      if (albumsResult.isSuccess()) {
        this.albums.set(albumsResult.getData().map((doc) => ({ ...doc.data, id: doc.id })));
      }
      if (songsResult.isSuccess()) {
        this.songs.set(songsResult.getData().map((doc) => doc.data));
      }
      if (collectionsResult.isSuccess()) {
        this.collections.set(collectionsResult.getData().map((doc) => ({ ...doc.data, id: doc.id })));
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load artist');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Re-fetches the artist profile after an edit so the header and theme refresh.
   */
  private async refreshArtist(): Promise<void> {
    const artistId = this.artist()?.artistId;
    if (!artistId) return;
    try {
      const result = await this.dbService.getDocument<Artist>('artists', artistId);
      if (result.isSuccess()) {
        this.artist.set(result.getData().data);
      }
      void this.themeService.loadThemeColors(undefined, undefined, artistId);
    } catch {
      // Non-blocking — the page keeps the previously loaded profile.
    }
  }

  /**
   * Re-fetches albums, songs, and collections after an in-place edit.
   */
  private async reloadCatalog(): Promise<void> {
    const artistId = this.artist()?.artistId;
    if (!artistId) return;
    try {
      const [albumsResult, songsResult, collectionsResult] = await Promise.all([
        this.dbService.getCollection<Album>('albums', {
          constraints: [where('artistId', '==', artistId), where('isDeleted', '==', false)],
        }),
        this.dbService.getCollection<Song>('songs', {
          constraints: [where('artistId', '==', artistId), where('isDeleted', '==', false)],
        }),
        this.dbService.getCollection<Collection>('collections', {
          constraints: [where('artistId', '==', artistId), where('isDeleted', '==', false)],
        }),
      ]);
      if (albumsResult.isSuccess()) {
        this.albums.set(albumsResult.getData().map((doc) => ({ ...doc.data, id: doc.id })));
      }
      if (songsResult.isSuccess()) {
        this.songs.set(songsResult.getData().map((doc) => doc.data));
      }
      if (collectionsResult.isSuccess()) {
        this.collections.set(collectionsResult.getData().map((doc) => ({ ...doc.data, id: doc.id })));
      }
    } catch {
      // Non-blocking — the page keeps the previously loaded catalog.
    }
  }

  /** Sets the active tab. In the artist management hub the tabs are routed so the URL
   *  (and the sidebar active state) always matches the open tab. */
  setTab(tab: ArtistTab): void {
    if (this.isSelfView) {
      void this.router.navigate(['/artist', tab]);
      return;
    }
    this.activeTab.set(tab);
  }

  /** Clears the shared search field. */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  /** Plays a song in the global player. */
  onPlayTrack(song: Song): void {
    this.audioPlayerService.playTrack(songToTrack(song, this.artist()?.name || '', this.getAlbumTitle(song.albumId)));
  }

  /** Plays every filtered song, starting at the given index. */
  async playAll(startIndex = 0): Promise<void> {
    const items = this.filteredSongs();
    if (items.length === 0) return;
    const artistName = this.artist()?.name || '';
    await this.audioPlayerService.playQueue(
      items.map((song) => songToTrack(song, artistName, this.getAlbumTitle(song.albumId))),
      startIndex,
    );
  }

  /** Resolves an album's title from the loaded album list. */
  getAlbumTitle(albumId?: string): string {
    if (!albumId) return '';
    return this.albums().find((album) => album.id === albumId)?.title || '';
  }

  /** Opens the add-to-playlist dialog for a song. */
  onAddToPlaylist(song: Song): void {
    this.playlistSongIds.set([song.songId]);
    this.isPlaylistDialogOpen.set(true);
  }

  /** Closes the add-to-playlist dialog. */
  closePlaylistDialog(): void {
    this.isPlaylistDialogOpen.set(false);
    this.playlistSongIds.set([]);
  }

  /**
   * Opens the artist profile edit dialog (owner artist or admin only).
   */
  openEditArtist(): void {
    const artist = this.artist();
    if (!artist || !this.canEdit()) return;
    const artistWithId: ArtistWithId = { ...artist, id: artist.artistId };
    const dialogRef = this.dialog.open<
      ArtistFormDialogComponent,
      { artist: ArtistWithId | null },
      ArtistFormDialogResult
    >(ArtistFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { artist: artistWithId },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.refreshArtist();
      }
    });
  }

  /**
   * Opens the album edit dialog (owner artist or admin only).
   *
   * @param album - The album to edit
   */
  openEditAlbum(album: AlbumWithId): void {
    if (!this.canEdit()) return;
    const dialogRef = this.dialog.open<
      AlbumFormDialogComponent,
      { album: AlbumWithId | null },
      AlbumFormDialogResult
    >(AlbumFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { album },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadCatalog();
      }
    });
  }

  /**
   * Opens the song edit dialog (owner artist or admin only).
   *
   * @param song - The song to edit
   */
  openEditSong(song: Song): void {
    if (!this.canEdit()) return;
    const songWithId: SongWithId = { ...song, id: song.songId };
    const dialogRef = this.dialog.open<
      SongFormDialogComponent,
      { song: SongWithId | null; albums: AlbumWithId[] },
      SongFormDialogResult
    >(SongFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { song: songWithId, albums: this.albums() },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadCatalog();
      }
    });
  }

  /**
   * Opens the create-album dialog (owner artist or admin only). Admins create the
   * album on behalf of the artist being managed via the passed artistId.
   */
  openCreateAlbum(): void {
    const artist = this.artist();
    if (!artist || !this.canEdit()) return;
    const dialogRef = this.dialog.open<
      AlbumFormDialogComponent,
      AlbumFormDialogData,
      AlbumFormDialogResult
    >(AlbumFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { album: null, artistId: artist.artistId },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadCatalog();
      }
    });
  }

  /**
   * Opens the create-song dialog with the preferred type preset (owner artist or admin only).
   *
   * @param preferredType - Initial song type; the Singles tab presets 'single'
   */
  openCreateSong(preferredType: 'album' | 'single' = 'album'): void {
    const artist = this.artist();
    if (!artist || !this.canEdit()) return;
    const dialogRef = this.dialog.open<
      SongFormDialogComponent,
      SongFormDialogData,
      SongFormDialogResult
    >(SongFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        song: null,
        albums: this.albums(),
        artistId: artist.artistId,
        defaultSongType: preferredType,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadCatalog();
      }
    });
  }

  /**
   * Soft-deletes an album after confirmation (owner artist or admin only).
   *
   * @param album - The album to delete
   */
  async deleteAlbum(album: AlbumWithId): Promise<void> {
    if (!this.canEdit()) return;
    if (!confirm(`Delete album "${album.title}"? This can be undone.`)) return;
    try {
      const result = await this.dbService.softDelete('albums', album.id);
      if (result.isSuccess()) {
        await this.reloadCatalog();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete album');
    }
  }

  /**
   * Soft-deletes a song after confirmation (owner artist or admin only).
   *
   * @param song - The song to delete
   */
  async deleteSong(song: Song): Promise<void> {
    if (!this.canEdit()) return;
    if (!confirm(`Delete song "${song.title}"? This can be undone.`)) return;
    try {
      const result = await this.dbService.softDelete('songs', song.songId);
      if (result.isSuccess()) {
        await this.reloadCatalog();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete song');
    }
  }

  /**
   * Opens the create-collection dialog (owner artist or admin only). The song
   * multi-select is populated from the artist's own songs loaded in the tab.
   */
  openCreateCollection(): void {
    const artist = this.artist();
    if (!artist || !this.canEdit()) return;
    const dialogRef = this.dialog.open<
      CollectionFormDialogComponent,
      CollectionFormDialogData,
      CollectionFormDialogResult
    >(CollectionFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { collection: null, artistId: artist.artistId, songs: this.songs() },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadCatalog();
      }
    });
  }

  /**
   * Opens the collection edit dialog (owner artist or admin only).
   *
   * @param collection - The collection to edit
   */
  openEditCollection(collection: CollectionWithId): void {
    if (!this.canEdit()) return;
    const dialogRef = this.dialog.open<
      CollectionFormDialogComponent,
      CollectionFormDialogData,
      CollectionFormDialogResult
    >(CollectionFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { collection, songs: this.songs() },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadCatalog();
      }
    });
  }

  /**
   * Soft-deletes a collection after confirmation (owner artist or admin only).
   *
   * @param collection - The collection to delete
   */
  async deleteCollection(collection: CollectionWithId): Promise<void> {
    if (!this.canEdit()) return;
    if (!confirm(`Delete collection "${collection.name}"? This can be undone.`)) return;
    try {
      const result = await this.collectionService.deleteCollection(collection.id);
      if (result.isSuccess()) {
        await this.reloadCatalog();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete collection');
    }
  }
}



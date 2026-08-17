import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DbService } from '../../core/services/db.service';
import { where } from '@angular/fire/firestore';
import { ThemeService } from '../../core/services/theme.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { Artist } from '../../shared/models/artist.interface';
import { Song } from '../../shared/models/song.interface';
import { Album } from '../../shared/models/album.interface';
import { Track } from '../../core/services/audio-player.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import { TrackRowComponent } from '../../shared/components/track-row/track-row.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  PurchaseDialogComponent,
  PurchaseDialogState,
} from '../../shared/components/purchase-dialog/purchase-dialog.component';
import { AddToPlaylistDialogComponent } from '../playlists/add-to-playlist-dialog.component';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { ReportService } from '../../core/services/report.service';

/**
 * Tab types for the explore page.
 */
type ExploreTab = 'fresh' | 'artists' | 'genre' | 'videos' | 'lyrics';

/**
 * Explore page — public browsing with tabbed content.
 *
 * Shared by guests and listeners. Role-based redirects at the route guard layer
 * send artists to /artist and admins to /admin before reaching this page.
 */
@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
    TrackRowComponent,
    EmptyStateComponent,
    PurchaseDialogComponent,
    AddToPlaylistDialogComponent,
  ],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit {
  private readonly dbService = inject(DbService);
  private readonly themeService = inject(ThemeService);
  private readonly audioPlayerService = inject(AudioPlayerService);
  private readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);
  private readonly reportService = inject(ReportService);

  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly artists = signal<Artist[]>([]);
  readonly albums = signal<Album[]>([]);
  readonly songs = signal<Song[]>([]);

  readonly activeTab = signal<ExploreTab>('fresh');
  readonly activeGenre = signal<string>('All');

  /** Purchase dialog state. */
  readonly dialogState = signal<PurchaseDialogState>('closed');
  readonly dialogSong = signal<Song | null>(null);
  readonly dialogError = signal<string>('');

  /** Add-to-playlist dialog state. */
  readonly isPlaylistDialogOpen = signal(false);
  readonly playlistSongIds = signal<string[]>([]);

  /** Recently released albums, sorted by release date desc. */
  readonly recentAlbums = computed(() => {
    return [...this.albums()]
      .sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 3);
  });

  /** Recently released songs, sorted by release date desc. */
  readonly recentSongs = computed(() => {
    return [...this.songs()]
      .sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);
  });

  /** Featured album — the most recent album across all artists. */
  readonly featuredAlbum = computed(() => this.recentAlbums()[0] ?? null);

  /** Songs belonging to the featured album. */
  readonly featuredAlbumSongs = computed(() => {
    const album = this.featuredAlbum();
    if (!album) return [];
    return this.songs()
      .filter((song) => song.albumId === album.albumId)
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  });

  /** Unique genres derived from all songs. */
  readonly genres = computed(() => {
    const genreSet = new Set<string>();
    for (const song of this.songs()) {
      if (song.genre) genreSet.add(song.genre);
      for (const tag of song.tags ?? []) {
        genreSet.add(tag);
      }
    }
    return ['All', ...Array.from(genreSet).sort()];
  });

  /** Songs filtered by the active genre chip. */
  readonly filteredSongsByGenre = computed(() => {
    const genre = this.activeGenre();
    if (genre === 'All') return this.songs();
    return this.songs().filter((song) => song.genre === genre || (song.tags ?? []).includes(genre));
  });

  /** Songs with YouTube video IDs for the Videos tab. */
  readonly videoSongs = computed(() => {
    return this.songs().filter((song) => !!song.youtubeVideoId);
  });

  /** Songs with lyrics for the Lyrics tab. */
  readonly lyricsSongs = computed(() => {
    return this.songs().filter((song) => !!song.lyrics && song.lyrics.trim().length > 0);
  });

  /** Whether the current user may purchase — authenticated with a granted role. */
  readonly canPurchase = computed(() => this.authService.hasGrantedRole());

  ngOnInit(): void {
    this.loadData();
  }

  /** Loads all artists, albums, and songs from Firestore. */
  private async loadData(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

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
        throw new Error(artistsResult.getError() || 'Failed to load artists');
      }
      if (albumsResult.isFailure()) {
        throw new Error(albumsResult.getError() || 'Failed to load albums');
      }
      if (songsResult.isFailure()) {
        throw new Error(songsResult.getError() || 'Failed to load songs');
      }

      // Fill each own-ID field from the Firestore document ID so navigation never
      // emits `/song|album|artist/undefined` for content that predates the create flows.
      this.artists.set(
        artistsResult
          .getData()
          .filter((doc) => !doc.data.isDeleted)
          .map((doc) => ({ ...doc.data, artistId: doc.data.artistId || doc.id })),
      );
      this.albums.set(
        albumsResult
          .getData()
          .filter((doc) => !doc.data.isDeleted)
          .map((doc) => ({ ...doc.data, albumId: doc.data.albumId || doc.id })),
      );
      this.songs.set(
        songsResult
          .getData()
          .filter((doc) => !doc.data.isDeleted)
          .map((doc) => ({ ...doc.data, songId: doc.data.songId || doc.id })),
      );

      // Apply theme from featured album or first artist
      const featured = this.featuredAlbum();
      const firstArtist = this.artists()[0];
      if (featured?.themeColors || firstArtist?.themeColors) {
        this.themeService.loadThemeColors(undefined, featured?.albumId, firstArtist?.artistId);
      }

      this.isLoading.set(false);
    } catch (err) {
      this.isLoading.set(false);
      const message = err instanceof Error ? err.message : 'Failed to load explore page';
      this.error.set(message);
      console.error('Explore page data loading error:', err);
    }
  }

  /** Retries loading explore data. */
  onRetry(): void {
    this.loadData();
  }

  /** Sets the active tab. */
  setTab(tab: ExploreTab): void {
    this.activeTab.set(tab);
  }

  /** Sets the active genre filter chip. */
  setGenre(genre: string): void {
    this.activeGenre.set(genre);
  }

  /** Plays a song in the global audio player. */
  onPlayTrack(song: Song): void {
    const track: Track = {
      id: song.songId,
      title: song.title,
      artist: this.getArtistName(song.artistId),
      artistId: song.artistId,
      albumId: song.albumId,
      albumTitle: this.getAlbumTitle(song.albumId),
      streamUrl: song.streamUrl,
      artworkUrl: song.artworkUrl,
      duration: song.duration,
      lyrics: song.lyrics,
      youtubeVideoId: song.youtubeVideoId,
      priceZAR: song.priceZAR,
      minimumPriceZAR: song.minimumPriceZAR,
    };

    this.audioPlayerService.playTrack(track);
  }

  /** Handles download button click — shows purchase dialog for granted users or non-purchasers. */
  onDownloadClick(song: Song): void {
    const user = this.authService.currentUser();
    // Visitors (authenticated with no granted role) are treated like guests:
    // they cannot purchase or download until they complete registration.
    if (!user || !this.authService.hasGrantedRole()) {
      this.dialogSong.set(song);
      this.dialogError.set('');
      this.dialogState.set('guest');
      return;
    }

    this.paymentService.checkPurchaseStatus(song.songId, user.userId).then((purchased) => {
      if (purchased) {
        this.downloadSong(song, user.userId);
      } else {
        this.dialogSong.set(song);
        this.dialogError.set('');
        this.dialogState.set('confirm');
      }
    });
  }

  /** Closes the purchase dialog. */
  closeDialog(): void {
    this.dialogState.set('closed');
    this.dialogSong.set(null);
    this.dialogError.set('');
  }

  /** Confirms the purchase from the dialog at the chosen amount. */
  async confirmPurchase(amount: number): Promise<void> {
    const song = this.dialogSong();
    const user = this.authService.currentUser();
    if (!song || !user) return;

    if (!song.priceZAR || song.priceZAR <= 0) {
      this.dialogError.set('This track is not available for purchase.');
      this.dialogState.set('error');
      return;
    }

    this.dialogState.set('purchasing');
    this.dialogError.set('');

    const result = await this.paymentService.initiateCheckout({
      songId: song.songId,
      purchaseType: 'single',
      amountZAR: amount,
      userId: user.userId,
      artistId: song.artistId,
    });

    if (result.isSuccess()) {
      const purchaseResult = result.getData();
      if (purchaseResult.success) {
        this.dialogState.set('success');
        setTimeout(() => {
          this.downloadSong(song, user.userId);
          this.closeDialog();
        }, 1500);
      } else if (purchaseResult.error) {
        this.dialogError.set(purchaseResult.error);
        this.dialogState.set('error');
      }
    } else {
      this.dialogError.set(result.getError() || 'Purchase failed. Please try again.');
      this.dialogState.set('error');
    }
  }

  /** Downloads a song using the payment service. */
  private async downloadSong(song: Song, userId: string): Promise<void> {
    const result = await this.paymentService.getDownloadUrl(song.songId, userId);
    if (result.isSuccess()) {
      const downloadInfo = result.getData();
      const artistName = this.getArtistName(song.artistId);
      this.paymentService.triggerDownload(downloadInfo, `${song.title} - ${artistName}.mp3`);
    } else {
      this.dialogError.set(result.getError() || 'Download failed. Please try again.');
      this.dialogState.set('error');
    }
  }

  /** Gets the artist name for a given artist ID. */
  getArtistName(artistId: string): string {
    return this.artists().find((a) => a.artistId === artistId)?.name || 'Unknown Artist';
  }

  /** Gets the album title for a given album ID. */
  getAlbumTitle(albumId?: string): string {
    if (!albumId) return '';
    return this.albums().find((a) => a.albumId === albumId)?.title || '';
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

  /** Resolves artwork URL for a song, falling back to album artwork. */
  getArtworkUrl(song: Song): string | null {
    if (song.artworkUrl) return song.artworkUrl;
    if (song.albumId) {
      const album = this.albums().find((a) => a.albumId === song.albumId);
      if (album?.artworkUrl) return album.artworkUrl;
    }
    return null;
  }
}

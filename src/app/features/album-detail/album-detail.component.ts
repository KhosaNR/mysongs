import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { where, orderBy } from '@angular/fire/firestore';
import { DbService } from '../../core/services/db.service';
import { ThemeService } from '../../core/services/theme.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { USER_ROLE } from '../../core/constants/navigation.constants';
import { Album } from '../../shared/models/album.interface';
import { Artist } from '../../shared/models/artist.interface';
import { Song } from '../../shared/models/song.interface';
import { songToTrack } from '../../core/utils/track-mapper';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TrackRowComponent } from '../../shared/components/track-row/track-row.component';
import { SearchInputComponent } from '../../shared/components/search-input/search-input.component';
import { AddToPlaylistDialogComponent } from '../playlists/add-to-playlist-dialog.component';
import {
  PurchaseDialogComponent,
  PurchaseDialogState,
  AlbumPurchaseItem,
} from '../../shared/components/purchase-dialog/purchase-dialog.component';
import {
  AlbumFormDialogComponent,
  AlbumFormDialogResult,
} from '../artist/album-management/album-form-dialog.component';
import {
  SongFormDialogComponent,
  SongFormDialogResult,
  SongWithId,
} from '../../shared/components/song-form-dialog/song-form-dialog.component';

/** Album with its Firestore document ID. */
interface AlbumWithId extends Album {
  readonly id: string;
}

/**
 * Public album detail page: artwork, artist link, play-album, the full track
 * list, add-to-playlist, and a right-hand "More from [artist]" rail showing two
 * other albums by the same artist.
 */
@Component({
  selector: 'app-album-detail',
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
    PurchaseDialogComponent,
  ],
  templateUrl: './album-detail.component.html',
  styleUrl: './album-detail.component.scss',
})
export class AlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dbService = inject(DbService);
  private readonly themeService = inject(ThemeService);
  private readonly audioPlayerService = inject(AudioPlayerService);
  private readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);
  private readonly dialog = inject(MatDialog);

  readonly album = signal<AlbumWithId | null>(null);
  readonly artist = signal<Artist | null>(null);
  readonly tracks = signal<Song[]>([]);
  readonly otherAlbums = signal<AlbumWithId[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  /** Purchase dialog state for the album buy flow. */
  readonly dialogState = signal<PurchaseDialogState>('closed');
  readonly dialogError = signal<string>('');
  readonly isAlbumPurchased = signal(false);
  readonly isDownloadingAlbum = signal(false);

  /** Single search field filtering the track list by track title. */
  readonly searchQuery = signal('');

  /** Whether the add-to-playlist dialog is open. */
  readonly isPlaylistDialogOpen = signal(false);

  protected readonly currentUser = this.authService.currentUser;

  /** Whether the current user may edit this album (owner artist or admin). */
  readonly canEdit = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.role === USER_ROLE.ADMIN) return true;
    return (
      user.role === USER_ROLE.ARTIST && !!user.artistId && user.artistId === this.album()?.artistId
    );
  });

  /** Tracks filtered by the search query (track title match). */
  readonly filteredTracks = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const tracks = this.tracks();
    if (!query) return tracks;
    return tracks.filter((track) => track.title.toLowerCase().includes(query));
  });

  /** Total duration of all tracks in mm:ss. */
  readonly totalDuration = computed(() => {
    const seconds = this.tracks().reduce((sum, track) => sum + (track.duration || 0), 0);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  /** Whether the album is purchasable (priced, has tracks, not already owned). */
  readonly canBuyAlbum = computed(() => {
    const album = this.album();
    if (!album || !album.priceZAR || album.priceZAR <= 0) return false;
    return this.tracks().length > 0 && !this.isAlbumPurchased();
  });

  /** Album summary handed to the purchase dialog. */
  protected readonly albumPurchaseItem = computed<AlbumPurchaseItem | null>(() => {
    const album = this.album();
    if (!album) return null;
    return {
      id: album.id,
      title: album.title,
      priceZAR: album.priceZAR,
      minimumPriceZAR: album.minimumPriceZAR,
      artistName: this.artist()?.name,
      trackCount: this.tracks().length,
    };
  });

  constructor() {
    const albumId = this.route.snapshot.paramMap.get('albumId');
    if (albumId) {
      void this.load(albumId);
    }
  }

  /**
   * Loads the album, its artist, ordered tracks, and two other albums by the
   * same artist, then applies the album theme.
   *
   * @param albumId - Album document ID
   */
  async load(albumId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const albumResult = await this.dbService.getDocument<Album>('albums', albumId);
      if (albumResult.isFailure()) {
        this.error.set(albumResult.getError());
        return;
      }
      const albumData = albumResult.getData();
      const album: AlbumWithId = { ...albumData.data, id: albumData.id };
      this.album.set(album);

      void this.themeService.loadThemeColors(undefined, album.id, album.artistId);

      const [artistResult, tracksResult] = await Promise.all([
        this.dbService.getDocument<Artist>('artists', album.artistId),
        this.dbService.getCollection<Song>('songs', {
          constraints: [
            where('albumId', '==', album.id),
            where('isDeleted', '==', false),
            orderBy('trackNumber', 'asc'),
          ],
        }),
      ]);

      if (artistResult.isSuccess()) {
        const artistData = artistResult.getData();
        this.artist.set({
          ...artistData.data,
          artistId: artistData.data.artistId || artistData.id,
        });
      }
      if (tracksResult.isSuccess()) {
        this.tracks.set(tracksResult.getData().map((doc) => doc.data));
      }

      // Check album ownership for granted users so the Buy/Download button
      // and per-track "Owned" badges reflect the ledger.
      const user = this.authService.currentUser();
      if (user && this.authService.hasGrantedRole()) {
        this.paymentService.checkAlbumPurchaseStatus(album.id, user.userId).then((purchased) => {
          this.isAlbumPurchased.set(purchased);
        });
      }

      await this.loadOtherAlbums(album);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load album');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Loads up to two other albums by the same artist, excluding the current one.
   *
   * @param album - The album being viewed
   */
  private async loadOtherAlbums(album: AlbumWithId): Promise<void> {
    const result = await this.dbService.getCollection<Album>('albums', {
      constraints: [where('artistId', '==', album.artistId), where('isDeleted', '==', false)],
    });
    if (!result.isSuccess()) return;

    const albums = result
      .getData()
      .map((doc) => ({ ...doc.data, id: doc.id }) as AlbumWithId)
      .filter((candidate) => candidate.id !== album.id);

    // Prefer the most recently released albums.
    albums.sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });

    this.otherAlbums.set(albums.slice(0, 2));
  }

  /**
   * Plays the entire (filtered) album from the given track index.
   *
   * @param startIndex - Track index to start playback at (default 0)
   */
  async playAlbum(startIndex = 0): Promise<void> {
    const items = this.filteredTracks();
    if (items.length === 0) return;
    const artistName = this.artist()?.name || '';
    const albumTitle = this.album()?.title || '';
    await this.audioPlayerService.playQueue(
      items.map((song) => songToTrack(song, artistName, albumTitle)),
      startIndex,
    );
  }

  /** Opens the add-to-playlist dialog for all album tracks. */
  openPlaylistDialog(): void {
    this.isPlaylistDialogOpen.set(true);
  }

  /** Closes the add-to-playlist dialog. */
  closePlaylistDialog(): void {
    this.isPlaylistDialogOpen.set(false);
  }

  /** Clears the track search field. */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  /**
   * Handles the Buy Album button: guests get the sign-in prompt, granted
   * users get the PWYW purchase dialog.
   */
  onBuyAlbumClick(): void {
    const user = this.authService.currentUser();
    if (!user || !this.authService.hasGrantedRole()) {
      this.dialogError.set('');
      this.dialogState.set('guest');
      return;
    }
    this.dialogError.set('');
    this.dialogState.set('confirm');
  }

  /** Closes the purchase dialog. */
  closeDialog(): void {
    this.dialogState.set('closed');
    this.dialogError.set('');
  }

  /**
   * Confirms the album purchase at the chosen amount.
   *
   * @param amount - The amount (ZAR) the buyer chose to pay
   */
  async confirmAlbumPurchase(amount: number): Promise<void> {
    const album = this.album();
    const user = this.authService.currentUser();
    if (!album || !user) return;

    if (!album.priceZAR || album.priceZAR <= 0 || this.tracks().length === 0) {
      this.dialogError.set('This album is not available for purchase.');
      this.dialogState.set('error');
      return;
    }

    this.dialogState.set('purchasing');
    this.dialogError.set('');

    const result = await this.paymentService.initiateCheckout({
      albumId: album.id,
      purchaseType: 'album',
      amountZAR: amount,
      userId: user.userId,
      artistId: album.artistId,
    });

    if (result.isSuccess()) {
      const purchaseResult = result.getData();
      if (purchaseResult.success) {
        this.isAlbumPurchased.set(true);
        this.dialogState.set('success');
      } else if (purchaseResult.error) {
        this.dialogError.set(purchaseResult.error);
        this.dialogState.set('error');
      }
    } else {
      this.dialogError.set(result.getError() || 'Purchase failed. Please try again.');
      this.dialogState.set('error');
    }
  }

  /**
   * Downloads every album track through the payment service. Sequential with a
   * short delay so browsers accept the multi-file download.
   */
  async downloadAlbum(): Promise<void> {
    const user = this.authService.currentUser();
    const items = this.tracks();
    if (!user || items.length === 0) return;

    this.isDownloadingAlbum.set(true);
    try {
      const artistName = this.artist()?.name || '';
      for (const song of items) {
        const result = await this.paymentService.getDownloadUrl(song.songId, user.userId);
        if (result.isSuccess()) {
          this.paymentService.triggerDownload(
            result.getData(),
            `${song.title} - ${artistName}.mp3`,
          );
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } finally {
      this.isDownloadingAlbum.set(false);
    }
  }

  /**
   * Re-fetches the album document and its ordered tracks after an in-place edit.
   */
  private async reloadAlbum(): Promise<void> {
    const album = this.album();
    if (!album) return;
    try {
      const [albumResult, tracksResult] = await Promise.all([
        this.dbService.getDocument<Album>('albums', album.id),
        this.dbService.getCollection<Song>('songs', {
          constraints: [
            where('albumId', '==', album.id),
            where('isDeleted', '==', false),
            orderBy('trackNumber', 'asc'),
          ],
        }),
      ]);
      if (albumResult.isSuccess()) {
        const data = albumResult.getData();
        this.album.set({ ...data.data, id: data.id });
      }
      if (tracksResult.isSuccess()) {
        this.tracks.set(tracksResult.getData().map((doc) => doc.data));
      }
    } catch {
      // Non-blocking — the page keeps the previously loaded album.
    }
  }

  /**
   * Opens the album edit dialog (owner artist or admin only).
   */
  openEditAlbum(): void {
    const album = this.album();
    if (!album || !this.canEdit()) return;
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
        void this.reloadAlbum();
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
    const album = this.album();
    const songWithId: SongWithId = { ...song, id: song.songId };
    const dialogRef = this.dialog.open<
      SongFormDialogComponent,
      { song: SongWithId | null; albums: AlbumWithId[] },
      SongFormDialogResult
    >(SongFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { song: songWithId, albums: album ? [album] : [] },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadAlbum();
      }
    });
  }
}

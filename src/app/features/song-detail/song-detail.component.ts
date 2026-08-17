import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DbService } from '../../core/services/db.service';
import { ThemeService } from '../../core/services/theme.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { USER_ROLE } from '../../core/constants/navigation.constants';
import { Song } from '../../shared/models/song.interface';
import { Album } from '../../shared/models/album.interface';
import { Artist } from '../../shared/models/artist.interface';
import { songToTrack } from '../../core/utils/track-mapper';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import {
  PurchaseDialogComponent,
  PurchaseDialogState,
} from '../../shared/components/purchase-dialog/purchase-dialog.component';
import { AddToPlaylistDialogComponent } from '../playlists/add-to-playlist-dialog.component';
import {
  SongFormDialogComponent,
  SongFormDialogResult,
  SongWithId,
  AlbumWithId,
} from '../../shared/components/song-form-dialog/song-form-dialog.component';

/**
 * Public song/track detail page: artwork, artist + album links, playback,
 * add-to-playlist, purchase/download, credits, and lyrics.
 */
@Component({
  selector: 'app-song-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
    PurchaseDialogComponent,
    AddToPlaylistDialogComponent,
  ],
  templateUrl: './song-detail.component.html',
  styleUrl: './song-detail.component.scss',
})
export class SongDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dbService = inject(DbService);
  private readonly themeService = inject(ThemeService);
  private readonly audioPlayerService = inject(AudioPlayerService);
  private readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);
  private readonly dialog = inject(MatDialog);

  readonly song = signal<Song | null>(null);
  readonly album = signal<(Album & { id: string }) | null>(null);
  readonly artist = signal<Artist | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  /** Whether the current user may edit this song (owner artist or admin). */
  readonly canEdit = computed(() => {
    const user = this.authService.currentUser();
    const song = this.song();
    if (!user || !song) return false;
    if (user.role === USER_ROLE.ADMIN) return true;
    return user.role === USER_ROLE.ARTIST && !!user.artistId && user.artistId === song.artistId;
  });

  /** Purchase dialog state. */
  readonly dialogState = signal<PurchaseDialogState>('closed');
  readonly dialogError = signal<string>('');
  readonly isPurchased = signal(false);

  /** Whether the add-to-playlist dialog is open. */
  readonly isPlaylistDialogOpen = signal(false);

  protected readonly currentUser = this.authService.currentUser;

  constructor() {
    const songId = this.route.snapshot.paramMap.get('songId');
    if (songId) {
      void this.load(songId);
    }
  }

  /**
   * Loads the song plus its album and artist context, applies the theme, and
   * checks the user's purchase status.
   *
   * @param songId - Song document ID
   */
  async load(songId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const songResult = await this.dbService.getDocument<Song>('songs', songId);
      if (songResult.isFailure()) {
        this.error.set(songResult.getError());
        return;
      }
      const song = songResult.getData().data;
      this.song.set(song);

      void this.themeService.loadThemeColors(song.songId, song.albumId, song.artistId);

      const [albumResult, artistResult] = await Promise.all([
        song.albumId
          ? this.dbService.getDocument<Album & { id: string }>('albums', song.albumId)
          : Promise.resolve(null),
        this.dbService.getDocument<Artist>('artists', song.artistId),
      ]);

      if (albumResult?.isSuccess()) {
        this.album.set(albumResult.getData().data);
      }
      if (artistResult?.isSuccess()) {
        const artistData = artistResult.getData();
        this.artist.set({
          ...artistData.data,
          artistId: artistData.data.artistId || artistData.id,
        });
      }

      const user = this.currentUser();
      if (user) {
        this.paymentService.checkPurchaseStatus(song.songId, user.userId).then((purchased) => {
          this.isPurchased.set(purchased);
        });
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load song');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Plays the song in the global player. */
  onPlay(): void {
    const song = this.song();
    if (!song) return;
    this.audioPlayerService.playTrack(
      songToTrack(song, this.artist()?.name || '', this.album()?.title || ''),
    );
  }

  /** Handles the download button (guest → login, owner → download, else purchase dialog). */
  onDownloadClick(): void {
    const song = this.song();
    if (!song) return;

    const user = this.currentUser();
    if (!user) {
      this.dialogError.set('');
      this.dialogState.set('guest');
      return;
    }

    if (this.isPurchased()) {
      this.downloadSong(song, user.userId);
      return;
    }

    if (!song.priceZAR || song.priceZAR <= 0) {
      this.dialogError.set('This track is not available for purchase.');
      this.dialogState.set('error');
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

  /** Confirms the purchase at the chosen amount and downloads on success. */
  async confirmPurchase(amount: number): Promise<void> {
    const song = this.song();
    const user = this.currentUser();
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
        this.isPurchased.set(true);
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

  /** Downloads a song through the payment service. */
  private async downloadSong(song: Song, userId: string): Promise<void> {
    const result = await this.paymentService.getDownloadUrl(song.songId, userId);
    if (result.isSuccess()) {
      const downloadInfo = result.getData();
      const artistName = this.artist()?.name || '';
      this.paymentService.triggerDownload(downloadInfo, `${song.title} - ${artistName}.mp3`);
    } else {
      this.dialogError.set(result.getError() || 'Download failed. Please try again.');
      this.dialogState.set('error');
    }
  }

  /** Opens the add-to-playlist dialog. */
  openPlaylistDialog(): void {
    this.isPlaylistDialogOpen.set(true);
  }

  /** Closes the add-to-playlist dialog. */
  closePlaylistDialog(): void {
    this.isPlaylistDialogOpen.set(false);
  }

  /** Formats a duration in seconds as mm:ss. */
  formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Re-fetches the song and its album/artist context after an in-place edit.
   */
  private async reloadSong(): Promise<void> {
    const song = this.song();
    if (!song) return;
    try {
      const songResult = await this.dbService.getDocument<Song>('songs', song.songId);
      if (songResult.isSuccess()) {
        this.song.set(songResult.getData().data);
      }
      const updated = this.song();
      if (updated?.albumId) {
        const albumResult = await this.dbService.getDocument<Album & { id: string }>(
          'albums',
          updated.albumId,
        );
        if (albumResult.isSuccess()) {
          this.album.set(albumResult.getData().data);
        }
      }
      void this.themeService.loadThemeColors(updated?.songId, updated?.albumId, updated?.artistId);
    } catch {
      // Non-blocking — the page keeps the previously loaded song.
    }
  }

  /**
   * Opens the song edit dialog (owner artist or admin only).
   */
  openEditSong(): void {
    const song = this.song();
    if (!song || !this.canEdit()) return;
    const songWithId: SongWithId = { ...song, id: song.songId };
    const album = this.album();
    const albums = album ? [{ ...album, id: album.id || album.albumId }] : [];
    const dialogRef = this.dialog.open<
      SongFormDialogComponent,
      { song: SongWithId | null; albums: AlbumWithId[] },
      SongFormDialogResult
    >(SongFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { song: songWithId, albums },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.reloadSong();
      }
    });
  }
}

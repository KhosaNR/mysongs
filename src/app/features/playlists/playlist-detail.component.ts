import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DbService } from '../../core/services/db.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { AuthService } from '../../core/services/auth.service';
import { Song } from '../../shared/models/song.interface';
import { PlaylistWithId } from '../../shared/models/playlist.interface';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TrackRowComponent } from '../../shared/components/track-row/track-row.component';
import { AddToPlaylistDialogComponent } from './add-to-playlist-dialog.component';

/** Song loaded for a playlist, resolved against its artist/album for the row. */
interface PlaylistSong {
  readonly song: Song;
  readonly artistName: string;
  readonly artworkUrl: string | null;
}

/**
 * Detail view for a saved playlist: plays the collection, removes tracks, and
 * renames/deletes the playlist.
 *
 * The route is public — anyone can open a playlist that its owner has made
 * public. Non-owners get a read-only view with a copy-to-playlist action;
 * private playlists that the visitor cannot read resolve to the 404 page.
 */
@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    TrackRowComponent,
    AddToPlaylistDialogComponent,
  ],
  templateUrl: './playlist-detail.component.html',
  styleUrl: './playlist-detail.component.scss',
})
export class PlaylistDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dbService = inject(DbService);
  private readonly playlistService = inject(PlaylistService);
  private readonly audioPlayerService = inject(AudioPlayerService);
  private readonly authService = inject(AuthService);

  protected readonly currentUser = this.authService.currentUser;

  readonly playlist = signal<PlaylistWithId | null>(null);
  readonly songs = signal<PlaylistSong[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isEditingName = signal(false);
  readonly editName = signal('');

  /** Whether the add-to-playlist (copy) dialog is open. */
  readonly isPlaylistDialogOpen = signal(false);

  /** Transient helper text (e.g. "share link copied"). */
  readonly feedback = signal<string | null>(null);

  /** Whether the current user owns the loaded playlist. */
  readonly isOwner = computed(() => this.currentUser()?.userId === this.playlist()?.userId);

  /** Song IDs offered for copying into the user's own playlists. */
  readonly copySongIds = computed(() => this.songs().map((item) => item.song.songId));

  /** Absolute share URL for a public playlist. */
  readonly shareUrl = computed(() => {
    const playlist = this.playlist();
    if (!playlist) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/playlist/${playlist.id}`;
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('playlistId');
    if (id) {
      void this.load(id);
    }
  }

  /**
   * Loads the playlist and its referenced songs.
   *
   * @param playlistId - Playlist document ID
   */
  async load(playlistId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.feedback.set(null);
    try {
      const playlistResult = await this.playlistService.getPlaylist(playlistId);
      if (playlistResult.isFailure()) {
        this.handleLoadFailure(playlistResult.getError());
        return;
      }
      const playlist = playlistResult.getData();
      this.playlist.set(playlist);

      if (playlist.songIds.length === 0) {
        this.songs.set([]);
        return;
      }

      const songsResult = await this.dbService.getCollection<Song>('songs', {
        constraints: [],
      });
      if (songsResult.isFailure()) {
        this.error.set(songsResult.getError());
        return;
      }

      const artistsResult = await this.dbService.getCollection<{ artistId: string; name: string }>('artists', {
        constraints: [],
      });
      const artistNames = new Map<string, string>();
      if (artistsResult.isSuccess()) {
        artistsResult.getData().forEach((doc) => {
          artistNames.set(doc.data.artistId, doc.data.name);
        });
      }

      const songsById = new Map(songsResult.getData().map((doc) => [doc.data.songId, doc.data]));

      const ordered: PlaylistSong[] = playlist.songIds
        .map((songId) => songsById.get(songId))
        .filter((song): song is Song => !!song)
        .map((song) => ({
          song,
          artistName: artistNames.get(song.artistId) || 'Unknown Artist',
          artworkUrl: song.artworkUrl || null,
        }));

      this.songs.set(ordered);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load playlist');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handles a playlist-load failure. Private playlists that the current user
   * cannot read (permission or missing document) resolve to the 404 page so no
   * existence is leaked; transient errors surface as an error banner instead.
   *
   * @param message - Consumer-facing error message from the load
   */
  private handleLoadFailure(message: string): void {
    if (message.includes('permission') || message.includes('not found')) {
      this.router.navigate(['/404']);
      return;
    }
    this.error.set(message);
  }

  /**
   * Plays the playlist from the given index.
   *
   * @param startIndex - Track index to start playback at (default 0)
   */
  async playAll(startIndex = 0): Promise<void> {
    const items = this.songs();
    if (items.length === 0) return;

    await this.audioPlayerService.playQueue(
      items.map((item) => ({
        id: item.song.songId,
        title: item.song.title,
        artist: item.artistName,
        artistId: item.song.artistId,
        albumId: item.song.albumId,
        streamUrl: item.song.streamUrl,
        artworkUrl: item.song.artworkUrl,
        duration: item.song.duration,
        lyrics: item.song.lyrics,
        youtubeVideoId: item.song.youtubeVideoId,
        priceZAR: item.song.priceZAR,
      })),
      startIndex,
    );
  }

  /**
   * Removes a song from the playlist.
   *
   * @param songId - Song ID to remove
   */
  async removeSong(songId: string): Promise<void> {
    const playlist = this.playlist();
    if (!playlist) return;
    this.isSaving.set(true);
    const result = await this.playlistService.removeSong(playlist.id, songId);
    if (result.isSuccess()) {
      await this.load(playlist.id);
    } else {
      this.error.set(result.getError());
    }
    this.isSaving.set(false);
  }

  /** Enables the rename input. */
  startRename(): void {
    this.editName.set(this.playlist()?.name ?? '');
    this.isEditingName.set(true);
  }

  /**
   * Syncs the rename input into the signal.
   *
   * @param event - Native input event
   */
  onEditNameInput(event: Event): void {
    this.editName.set((event.target as HTMLInputElement).value);
  }

  /** Saves a renamed playlist. */
  async saveRename(): Promise<void> {
    const playlist = this.playlist();
    const name = this.editName().trim();
    if (!playlist || !name) return;

    this.isSaving.set(true);
    const result = await this.playlistService.updatePlaylist(playlist.id, { name });
    if (result.isSuccess()) {
      this.isEditingName.set(false);
      await this.load(playlist.id);
    } else {
      this.error.set(result.getError());
    }
    this.isSaving.set(false);
  }

  /**
   * Deletes the playlist and returns to the playlists overview.
   */
  async deletePlaylist(): Promise<void> {
    const playlist = this.playlist();
    if (!playlist) return;
    if (!confirm(`Delete playlist "${playlist.name}"? This cannot be undone.`)) return;

    const result = await this.playlistService.deletePlaylist(playlist.id);
    if (result.isSuccess()) {
      this.router.navigate(['/playlists']);
    } else {
      this.error.set(result.getError());
    }
  }

  /** Opens the copy-to-playlist dialog seeded with the playlist's songs. */
  openCopyDialog(): void {
    this.isPlaylistDialogOpen.set(true);
  }

  /** Closes the copy-to-playlist dialog. */
  closeCopyDialog(): void {
    this.isPlaylistDialogOpen.set(false);
  }

  /**
   * Toggles the playlist's public visibility (owner only).
   */
  async togglePublic(): Promise<void> {
    const playlist = this.playlist();
    if (!playlist || !this.isOwner()) return;
    this.isSaving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    const result = await this.playlistService.updatePlaylist(playlist.id, {
      isPublic: !playlist.isPublic,
    });
    if (result.isSuccess()) {
      await this.load(playlist.id);
    } else {
      this.error.set(result.getError());
    }
    this.isSaving.set(false);
  }

  /**
   * Copies the public share URL to the clipboard (owner only).
   */
  async copyShareLink(): Promise<void> {
    const url = this.shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.feedback.set('Share link copied to clipboard.');
    } catch {
      this.feedback.set('Could not copy automatically — select the link below.');
    }
  }
}


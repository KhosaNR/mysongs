import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { PlaylistWithId } from '../../shared/models/playlist.interface';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/**
 * Listener dashboard listing the current user's saved playlists with a
 * create-new-playlist form.
 */
@Component({
  selector: 'app-playlists',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './playlists.component.html',
  styleUrl: './playlists.component.scss',
})
export class PlaylistsComponent {
  private readonly authService = inject(AuthService);
  private readonly playlistService = inject(PlaylistService);

  protected readonly currentUser = this.authService.currentUser;

  readonly playlists = signal<PlaylistWithId[]>([]);
  readonly isLoading = signal(true);
  readonly isCreating = signal(false);
  readonly error = signal<string | null>(null);
  readonly newPlaylistName = signal('');

  /** Total track count across all playlists (shown in the header). */
  readonly totalTracks = computed(() =>
    this.playlists().reduce((sum, playlist) => sum + playlist.songIds.length, 0),
  );

  constructor() {
    void this.load();
  }

  /**
   * Loads the current user's playlists.
   */
  async load(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.playlistService.getUserPlaylists(user.userId);
      if (result.isSuccess()) {
        this.playlists.set(result.getData());
      } else {
        this.error.set(result.getError());
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Syncs the new-playlist-name input into the signal.
   *
   * @param event - Native input event
   */
  onNewPlaylistNameInput(event: Event): void {
    this.newPlaylistName.set((event.target as HTMLInputElement).value);
  }

  /**
   * Creates a new empty playlist and refreshes the list.
   */
  async createPlaylist(): Promise<void> {
    const user = this.currentUser();
    const name = this.newPlaylistName().trim();
    if (!user || !name || this.isCreating()) return;

    this.isCreating.set(true);
    this.error.set(null);
    try {
      const result = await this.playlistService.createPlaylist(user.userId, name);
      if (result.isSuccess()) {
        this.newPlaylistName.set('');
        await this.load();
      } else {
        this.error.set(result.getError());
      }
    } finally {
      this.isCreating.set(false);
    }
  }

  /**
   * Deletes a playlist after confirmation.
   *
   * @param playlist - Playlist to delete
   */
  async deletePlaylist(playlist: PlaylistWithId): Promise<void> {
    if (!confirm(`Delete playlist "${playlist.name}"? This cannot be undone.`)) return;
    const result = await this.playlistService.deletePlaylist(playlist.id);
    if (result.isSuccess()) {
      await this.load();
    } else {
      this.error.set(result.getError());
    }
  }
}

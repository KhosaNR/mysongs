import { Component, inject, input, output, signal, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModalDialogComponent } from '../../shared/components/modal-dialog/modal-dialog.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AuthService } from '../../core/services/auth.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { PlaylistWithId } from '../../shared/models/playlist.interface';

/**
 * Modal for adding songs to a saved playlist.
 *
 * Authenticated users see their playlists with per-playlist "Add" actions plus
 * a create-new-playlist form; guests are prompted to sign in first.
 */
@Component({
  selector: 'app-add-to-playlist-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalDialogComponent, LoadingSpinnerComponent],
  templateUrl: './add-to-playlist-dialog.component.html',
  styleUrl: './add-to-playlist-dialog.component.scss',
})
export class AddToPlaylistDialogComponent {
  private readonly authService = inject(AuthService);
  private readonly playlistService = inject(PlaylistService);
  private readonly router = inject(Router);

  /** Whether the dialog is open. */
  readonly isOpen = input(false);

  /** Song IDs to add to a playlist. */
  readonly songIds = input<string[]>([]);

  /** Emitted when the dialog should close. */
  readonly closed = output<void>();

  /** The current user, or null for guests. */
  protected readonly currentUser = this.authService.currentUser;

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly playlists = signal<PlaylistWithId[]>([]);
  readonly newPlaylistName = signal('');
  readonly isCreating = signal(false);
  readonly feedback = signal<string | null>(null);

  constructor() {
    // Load the user's playlists each time the dialog opens.
    effect(() => {
      if (this.isOpen()) {
        void this.onOpened();
      }
    });
  }

  /** Loads the user's playlists whenever the dialog opens. */
  async onOpened(): Promise<void> {
    if (!this.isOpen()) return;
    this.error.set(null);
    this.feedback.set(null);
    this.newPlaylistName.set('');

    const user = this.currentUser();
    if (!user) return;

    this.isLoading.set(true);
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

  /** Whether every requested song already belongs to the playlist. */
  containsAll(playlist: PlaylistWithId): boolean {
    return this.songIds().every((id) => playlist.songIds.includes(id));
  }

  /** Adds the requested songs to an existing playlist. */
  async addToPlaylist(playlist: PlaylistWithId): Promise<void> {
    this.error.set(null);
    this.feedback.set(null);
    const result = await this.playlistService.addSongs(playlist.id, this.songIds());
    if (result.isSuccess()) {
      this.feedback.set(`Added to "${playlist.name}"`);
      await this.refresh();
    } else {
      this.error.set(result.getError());
    }
  }

  /** Creates a new playlist seeded with the requested songs. */
  async createPlaylist(): Promise<void> {
    const user = this.currentUser();
    const name = this.newPlaylistName().trim();
    if (!user || !name) return;

    this.isCreating.set(true);
    this.error.set(null);
    this.feedback.set(null);

    const result = await this.playlistService.createPlaylist(user.userId, name, this.songIds());
    if (result.isSuccess()) {
      this.feedback.set(`Created "${name}" and added the track(s).`);
      this.newPlaylistName.set('');
      await this.refresh();
    } else {
      this.error.set(result.getError());
    }
    this.isCreating.set(false);
  }

  /** Reloads the user's playlists from Firestore. */
  private async refresh(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    const result = await this.playlistService.getUserPlaylists(user.userId);
    if (result.isSuccess()) {
      this.playlists.set(result.getData());
    }
  }

  /** Closes the dialog. */
  close(): void {
    this.closed.emit();
  }

  /**
   * Syncs the new-playlist-name input into the signal.
   *
   * @param event - Native input event
   */
  onNewPlaylistNameInput(event: Event): void {
    this.newPlaylistName.set((event.target as HTMLInputElement).value);
  }

  /** Navigates to login (guests only). */
  goToLogin(): void {
    this.close();
    this.router.navigate(['/auth/login']);
  }

  /** Navigates to registration (guests only). */
  goToRegister(): void {
    this.close();
    this.router.navigate(['/auth/sign-up']);
  }
}

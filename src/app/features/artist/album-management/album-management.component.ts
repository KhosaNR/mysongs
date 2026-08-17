import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { where, orderBy } from '@angular/fire/firestore';
import { DbService } from '../../../core/services/db.service';
import { AuthService } from '../../../core/services/auth.service';
import { Album } from '../../../shared/models/album.interface';
import { Song } from '../../../shared/models/song.interface';
import { AlbumFormDialogComponent, AlbumFormDialogResult } from './album-form-dialog.component';

/**
 * Album document including the Firestore document id.
 */
export interface AlbumWithId extends Album {
  readonly id: string;
}

/**
 * Song document including the Firestore document id, used within ContA.
 */
export interface SongWithId extends Song {
  readonly id: string;
}

/**
 * Artist album management view.
 *
 * Shows the artist's own albums in a card grid and a detail container ("ContA")
 * with a long album-info banner and the album's track list. Creating an album
 * auto-opens ContA for the newly created album.
 */
@Component({
  selector: 'app-album-management',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTableModule,
  ],
  templateUrl: './album-management.component.html',
  styleUrl: './album-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlbumManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly albums = signal<AlbumWithId[]>([]);
  readonly selectedAlbum = signal<AlbumWithId | null>(null);
  readonly albumSongs = signal<SongWithId[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingTracks = signal(false);
  readonly error = signal<string | null>(null);
  readonly showDeleted = signal(false);
  readonly trackCounts = signal<Record<string, number>>({});

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');

  /**
   * Columns displayed in the album tracks table.
   */
  protected readonly displayedColumns = ['trackNumber', 'title', 'duration', 'video', 'actions'] as const;

  constructor() {
    this.loadAlbums();
  }

  /**
   * Loads the artist's own albums and computes track counts.
   */
  async loadAlbums(): Promise<void> {
    const id = this.artistId();
    if (!id) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const albumsResult = await this.dbService.getCollection<Album>('albums', {
        constraints: [where('artistId', '==', id)],
      });

      if (albumsResult.isSuccess()) {
        let albumsData = albumsResult
          .getData()
          .map((doc) => ({ ...doc.data, id: doc.id }) as AlbumWithId);
        if (!this.showDeleted()) {
          albumsData = albumsData.filter((album) => !album.isDeleted);
        }
        this.albums.set(albumsData);

        const songsResult = await this.dbService.getCollection<Song>('songs', {
          constraints: [where('artistId', '==', id)],
        });

        if (songsResult.isSuccess()) {
          const counts: Record<string, number> = {};
          for (const song of songsResult.getData()) {
            const albumId = song.data.albumId;
            if (albumId && !song.data.isDeleted) {
              counts[albumId] = (counts[albumId] || 0) + 1;
            }
          }
          this.trackCounts.set(counts);
        }
      } else {
        this.error.set(albumsResult.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load albums');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Opens ContA for the given album and loads its tracks.
   */
  async openContA(album: AlbumWithId): Promise<void> {
    this.selectedAlbum.set(album);
    await this.loadAlbumSongs(album.id);
  }

  /**
   * Loads the tracks belonging to an album, sorted by track number.
   */
  private async loadAlbumSongs(albumId: string): Promise<void> {
    const id = this.artistId();
    if (!id) return;

    this.isLoadingTracks.set(true);
    this.error.set(null);

    try {
      const songsResult = await this.dbService.getCollection<Song>('songs', {
        constraints: [
          where('artistId', '==', id),
          where('albumId', '==', albumId),
          where('isDeleted', '==', false),
          orderBy('trackNumber', 'asc'),
        ],
      });

      if (songsResult.isSuccess()) {
        this.albumSongs.set(
          songsResult.getData().map((doc) => ({ ...doc.data, id: doc.id }) as SongWithId),
        );
      } else {
        this.error.set(songsResult.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load album tracks');
    } finally {
      this.isLoadingTracks.set(false);
    }
  }

  /**
   * Closes ContA and returns to the album grid.
   */
  closeContA(): void {
    this.selectedAlbum.set(null);
    this.albumSongs.set([]);
  }

  /**
   * Navigates to the Songs screen with this album pre-selected for a new song.
   */
  addSongToAlbum(album: AlbumWithId): void {
    this.router.navigate(['/artist/songs'], { queryParams: { albumId: album.id } });
  }

  /**
   * Formats a duration in seconds as mm:ss.
   */
  formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Opens the create-album dialog.
   */
  openCreateForm(): void {
    const dialogRef = this.dialog.open<
      AlbumFormDialogComponent,
      { album: AlbumWithId | null },
      AlbumFormDialogResult
    >(AlbumFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { album: null },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result?.saved) {
        return;
      }
      void this.loadAlbums();
      if (result.album) {
        void this.openContA(result.album);
      }
    });
  }

  /**
   * Opens the edit-album dialog for the given album.
   */
  openEditForm(album: AlbumWithId): void {
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
        void this.loadAlbums();
      }
    });
  }

  /**
   * Resolves the display track number for a table row.
   */
  trackNumberFor(song: SongWithId): number {
    return song.trackNumber ?? this.albumSongs().indexOf(song) + 1;
  }

  /**
   * Soft-deletes an album.
   */
  async deleteAlbum(album: AlbumWithId): Promise<void> {
    if (!confirm(`Delete album "${album.title}"? This can be undone.`)) {
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.softDelete('albums', album.id);
      if (result.isSuccess()) {
        if (this.selectedAlbum()?.id === album.id) {
          this.closeContA();
        }
        await this.loadAlbums();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete album');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Restores a soft-deleted album.
   */
  async restoreAlbum(album: AlbumWithId): Promise<void> {
    if (!confirm(`Restore album "${album.title}"?`)) {
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.restore('albums', album.id);
      if (result.isSuccess()) {
        await this.loadAlbums();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to restore album');
    } finally {
      this.isLoading.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }
}

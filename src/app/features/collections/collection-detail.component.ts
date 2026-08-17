import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { where } from '@angular/fire/firestore';
import { DbService } from '../../core/services/db.service';
import { CollectionService } from '../../core/services/collection.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { AuthService } from '../../core/services/auth.service';
import { Artist } from '../../shared/models/artist.interface';
import { Song } from '../../shared/models/song.interface';
import { CollectionWithId } from '../../shared/models/collection.interface';
import { songToTrack } from '../../core/utils/track-mapper';
import { USER_ROLE } from '../../core/constants/navigation.constants';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TrackRowComponent } from '../../shared/components/track-row/track-row.component';
import { AddToPlaylistDialogComponent } from '../playlists/add-to-playlist-dialog.component';
import {
  CollectionFormDialogComponent,
  CollectionFormDialogData,
  CollectionFormDialogResult,
} from '../artist/collection-management/collection-form-dialog.component';

/** Song resolved against its artist for the collection's track rows. */
interface CollectionSong {
  readonly song: Song;
  readonly artistName: string;
}

/**
 * Public collection detail page: the artist-curated song set with play-all,
 * copy-to-playlist, and (for the owning artist or an admin) in-place editing.
 */
@Component({
  selector: 'app-collection-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
    EmptyStateComponent,
    TrackRowComponent,
    AddToPlaylistDialogComponent,
  ],
  templateUrl: './collection-detail.component.html',
  styleUrl: './collection-detail.component.scss',
})
export class CollectionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dbService = inject(DbService);
  private readonly collectionService = inject(CollectionService);
  private readonly audioPlayerService = inject(AudioPlayerService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  readonly collection = signal<CollectionWithId | null>(null);
  readonly artist = signal<Artist | null>(null);
  readonly songs = signal<CollectionSong[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isDeleting = signal(false);

  /** Whether the add-to-playlist (copy) dialog is open. */
  readonly isPlaylistDialogOpen = signal(false);

  /** Song IDs offered for copying into the user's own playlists. */
  readonly copySongIds = computed(() => this.songs().map((item) => item.song.songId));

  /** Whether the current user may edit this collection (owner artist or admin). */
  readonly canEdit = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.role === USER_ROLE.ADMIN) return true;
    return (
      user.role === USER_ROLE.ARTIST &&
      !!user.artistId &&
      user.artistId === this.collection()?.artistId
    );
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('collectionId');
    if (id) {
      void this.load(id);
    }
  }

  /**
   * Loads the collection, its artist, and the referenced songs in order.
   *
   * @param collectionId - Collection document ID
   */
  async load(collectionId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const collectionResult = await this.collectionService.getCollection(collectionId);
      if (collectionResult.isFailure()) {
        this.error.set(collectionResult.getError());
        return;
      }
      const collection = collectionResult.getData();
      this.collection.set(collection);

      const [artistResult, songsResult] = await Promise.all([
        this.dbService.getDocument<Artist>('artists', collection.artistId),
        this.dbService.getCollection<Song>('songs', {
          constraints: [where('isDeleted', '==', false)],
        }),
      ]);
      if (artistResult.isSuccess()) {
        const artistData = artistResult.getData();
        this.artist.set({
          ...artistData.data,
          artistId: artistData.data.artistId || artistData.id,
        });
      }

      if (collection.songIds.length === 0) {
        this.songs.set([]);
        return;
      }

      if (songsResult.isFailure()) {
        this.error.set(songsResult.getError());
        return;
      }

      const songsById = new Map(
        songsResult.getData().map((doc) => [doc.data.songId || doc.id, doc.data]),
      );
      const artistName = this.artist()?.name || 'Unknown Artist';

      const ordered: CollectionSong[] = collection.songIds
        .map((songId) => songsById.get(songId))
        .filter((song): song is Song => !!song)
        .map((song) => ({ song, artistName }));

      this.songs.set(ordered);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Plays the collection from the given index.
   *
   * @param startIndex - Track index to start playback at (default 0)
   */
  async playAll(startIndex = 0): Promise<void> {
    const items = this.songs();
    if (items.length === 0) return;
    const artistName = this.artist()?.name || '';
    const collectionName = this.collection()?.name || '';
    await this.audioPlayerService.playQueue(
      items.map((item) => songToTrack(item.song, artistName, collectionName)),
      startIndex,
    );
  }

  /** Opens the copy-to-playlist dialog for the whole collection. */
  openCopyDialog(): void {
    this.isPlaylistDialogOpen.set(true);
  }

  /** Closes the copy-to-playlist dialog. */
  closeCopyDialog(): void {
    this.isPlaylistDialogOpen.set(false);
  }

  /**
   * Opens the collection edit dialog (owner artist or admin only).
   */
  openEditCollection(): void {
    const collection = this.collection();
    if (!collection || !this.canEdit()) return;
    const dialogRef = this.dialog.open<
      CollectionFormDialogComponent,
      CollectionFormDialogData,
      CollectionFormDialogResult
    >(CollectionFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        collection,
        songs: this.songs().map((item) => item.song),
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        void this.load(collection.id);
      }
    });
  }

  /**
   * Soft-deletes the collection (owner artist or admin only) and returns to
   * the owning artist's page.
   */
  async deleteCollection(): Promise<void> {
    const collection = this.collection();
    if (!collection || !this.canEdit()) return;
    if (!confirm(`Delete collection "${collection.name}"? This can be undone.`)) return;
    this.isDeleting.set(true);
    const result = await this.collectionService.deleteCollection(collection.id);
    this.isDeleting.set(false);
    if (result.isSuccess()) {
      this.router.navigate(['/artist', collection.artistId]);
    } else {
      this.error.set(result.getError());
    }
  }
}

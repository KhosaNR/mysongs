/**
 * Create/edit collection dialog opened by the artist hub (ArtistDetailComponent)
 * via MatDialog.
 *
 * Owns the collection Signal Forms model (name/description) plus a multi-select
 * of the artist's own songs, and performs the create/update database writes.
 */
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormRoot, FormField, form, required } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { CollectionService } from '../../../core/services/collection.service';
import { Song } from '../../../shared/models/song.interface';
import { CollectionWithId } from '../../../shared/models/collection.interface';

/** Data passed into the dialog: the collection being edited, or null to create. */
export interface CollectionFormDialogData {
  readonly collection: CollectionWithId | null;
  /**
   * Artist who will own a newly created collection (create mode only).
   * Defaults to the signed-in user's artistId — lets admins create a
   * collection on behalf of a managed artist.
   */
  readonly artistId?: string;
  /** The artist's own songs available for selection (collections are own-song only). */
  readonly songs: readonly Song[];
}

/** Result emitted when the dialog closes. */
export interface CollectionFormDialogResult {
  readonly saved: boolean;
}

@Component({
  selector: 'app-collection-form-dialog',
  standalone: true,
  imports: [
    FormRoot,
    FormField,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './collection-form-dialog.component.html',
  styleUrl: './collection-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionFormDialogComponent {
  private readonly authService = inject(AuthService);
  private readonly collectionService = inject(CollectionService);
  private readonly dialogRef = inject<MatDialogRef<CollectionFormDialogComponent, CollectionFormDialogResult>>(MatDialogRef);
  private readonly data = inject<CollectionFormDialogData>(MAT_DIALOG_DATA);

  /** Whether the dialog edits an existing collection (false = create new). */
  readonly isEditMode = this.data.collection !== null;

  /** The artist's own songs offered in the multi-select. */
  readonly songs = this.data.songs;

  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);

  /** Song IDs currently selected for the collection. */
  readonly selectedSongIds = signal<string[]>(this.data.collection ? [...this.data.collection.songIds] : []);

  readonly formData = signal({
    name: this.data.collection?.name ?? '',
    description: this.data.collection?.description ?? '',
  });

  readonly collectionForm = form(this.formData, (p) => {
    required(p.name, { message: 'Collection name is required' });
  });

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');

  /**
   * Toggles a song's membership in the collection selection.
   *
   * @param songId - Song document ID to toggle
   */
  toggleSong(songId: string): void {
    const selected = this.selectedSongIds();
    this.selectedSongIds.set(
      selected.includes(songId) ? selected.filter((id) => id !== songId) : [...selected, songId],
    );
  }

  /**
   * Closes the dialog without saving.
   */
  close(): void {
    this.dialogRef.close({ saved: false });
  }

  /**
   * Saves a new or edited collection.
   */
  async save(): Promise<void> {
    this.collectionForm().markAsTouched();
    if (this.collectionForm().invalid()) {
      return;
    }

    // Create mode requires an artist ownership link; edit mode does not, so
    // admins (who have no artistId) can still update any existing collection.
    const id = this.data.artistId ?? this.artistId();
    const data = this.formData();

    if (!this.isEditMode && !id) {
      this.error.set('No artist ID assigned to this account.');
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    try {
      if (this.isEditMode && this.data.collection) {
        const result = await this.collectionService.updateCollection(this.data.collection.id, {
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          songIds: this.selectedSongIds(),
        });
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      } else {
        const result = await this.collectionService.createCollection(
          id,
          data.name,
          data.description,
          this.selectedSongIds(),
        );
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to save collection');
    } finally {
      this.isSaving.set(false);
    }
  }
}

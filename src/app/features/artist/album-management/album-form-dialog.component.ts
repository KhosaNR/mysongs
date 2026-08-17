/**
 * Create/edit album dialog opened by AlbumManagementComponent via MatDialog.
 *
 * Owns the album Signal Forms model, cover-art upload, and the create/update
 * database writes. Closes with an `AlbumFormDialogResult` so the parent can
 * refresh its album grid and open the detail view for newly created albums.
 */
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormRoot, FormField, form, required, min, validate } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DbService } from '../../../core/services/db.service';
import { AuthService } from '../../../core/services/auth.service';
import { UploadService } from '../../../core/services/upload.service';
import { Album, AlbumCredits } from '../../../shared/models/album.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../../core/constants/theme.constants';
import type { AlbumWithId } from './album-management.component';

/**
 * Data passed into the dialog: the album being edited, or null to create.
 */
export interface AlbumFormDialogData {
  readonly album: AlbumWithId | null;
  /**
   * Artist who will own a newly created album (create mode only). Defaults to the
   * signed-in user's artistId — lets admins create albums on behalf of a managed artist.
   */
  readonly artistId?: string;
}

/**
 * Result emitted when the dialog closes.
 */
export interface AlbumFormDialogResult {
  readonly saved: boolean;
  readonly album?: AlbumWithId;
}

@Component({
  selector: 'app-album-form-dialog',
  standalone: true,
  imports: [
    FormRoot,
    FormField,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './album-form-dialog.component.html',
  styleUrl: './album-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlbumFormDialogComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);
  private readonly dialogRef = inject<MatDialogRef<AlbumFormDialogComponent, AlbumFormDialogResult>>(MatDialogRef);
  private readonly data = inject<AlbumFormDialogData>(MAT_DIALOG_DATA);

  /** Whether the dialog edits an existing album (false = create new). */
  readonly isEditMode = this.data.album !== null;

  /** Current upload progress (0-100) for cover art. */
  readonly uploadProgress = this.uploadService.uploadProgress;

  readonly isSaving = signal(false);
  readonly isUploadingArtwork = signal(false);
  readonly error = signal<string | null>(null);
  readonly artworkPreview = signal<string | null>(this.data.album?.artworkUrl ?? null);
  private readonly artworkFile = signal<File | null>(null);

  readonly formData = signal({
    title: this.data.album?.title ?? '',
    genre: this.data.album?.genre ?? '',
    country: this.data.album?.country ?? '',
    releaseDate: this.data.album?.releaseDate
      ? new Date(this.data.album.releaseDate).toISOString().slice(0, 10)
      : '',
    writtenBy: this.data.album?.credits?.writtenBy ?? '',
    producedBy: this.data.album?.credits?.producedBy ?? '',
    mixedMasteredBy: this.data.album?.credits?.mixedMasteredBy ?? '',
    priceZAR: this.data.album?.priceZAR ?? 0,
    minimumPriceZAR: this.data.album?.minimumPriceZAR ?? 0,
    primaryColor: this.data.album?.themeColors?.primary ?? DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: this.data.album?.themeColors?.secondary ?? DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: this.data.album?.themeColors?.tertiary ?? DEFAULT_PLATFORM_COLORS.tertiary,
  });

  readonly albumForm = form(this.formData, (p) => {
    required(p.title, { message: 'Album title is required' });
    required(p.priceZAR, { message: 'Price is required' });
    min(p.priceZAR, 0, { message: 'Price cannot be negative' });
    min(p.minimumPriceZAR, 0, { message: 'Minimum price cannot be negative' });
    validate(p.minimumPriceZAR, (ctx) => {
      const minimum = ctx.value() ?? 0;
      const standard = ctx.valueOf(p.priceZAR) ?? 0;
      if (minimum > standard) {
        return { kind: 'min', message: 'Minimum price cannot exceed the standard price' };
      }
      return undefined;
    });
  });

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');

  /**
   * Closes the dialog without saving.
   */
  close(): void {
    this.dialogRef.close({ saved: false });
  }

  /**
   * Handles cover art file selection with preview.
   */
  onArtworkSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.artworkFile.set(input.files[0]);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.artworkPreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  /**
   * Saves a new or edited album, uploading cover art first if selected.
   */
  async save(): Promise<void> {
    this.albumForm().markAsTouched();
    if (this.albumForm().invalid()) {
      return;
    }

    // Create mode requires an artist ownership link; edit mode does not, so
    // admins (who have no artistId) can still update any existing album. For
    // create mode the owning artistId comes from the dialog data first (set by
    // the artist management hub) and falls back to the signed-in user.
    const id = this.data.artistId ?? this.artistId();
    const data = this.formData();

    if (!this.isEditMode && !id) {
      this.error.set('No artist ID assigned to this account.');
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    try {
      let artworkUrl: string | undefined;

      const file = this.artworkFile();
      if (file) {
        this.isUploadingArtwork.set(true);
        const upload = await this.uploadService.uploadFile(file);
        artworkUrl = upload.publicUrl;
        this.isUploadingArtwork.set(false);
      }

      const credits: AlbumCredits = {
        writtenBy: data.writtenBy.trim() || undefined,
        producedBy: data.producedBy.trim() || undefined,
        mixedMasteredBy: data.mixedMasteredBy.trim() || undefined,
      };

      const albumData: Partial<Album> = {
        title: data.title.trim(),
        genre: data.genre.trim() || undefined,
        country: data.country.trim() || undefined,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
        credits,
        priceZAR: data.priceZAR,
        minimumPriceZAR: data.minimumPriceZAR > 0 ? data.minimumPriceZAR : undefined,
        themeColors: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          tertiary: data.tertiaryColor,
        },
        ...(artworkUrl ? { artworkUrl } : {}),
        updatedAt: new Date(),
      };

      if (this.isEditMode && this.data.album) {
        const result = await this.dbService.update('albums', this.data.album.id, albumData);
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      } else {
        const albumId = this.dbService.generateId();
        const result = await this.dbService.createWithId(
          'albums',
          albumId,
          {
            ...albumData,
            albumId,
            artistId: id,
            createdAt: new Date(),
          } as Album,
          { softDeletable: true },
        );
        if (result.isSuccess()) {
          const newAlbum: AlbumWithId = {
            id: albumId,
            ...(albumData as Album),
            albumId,
            artistId: id,
            createdAt: new Date(),
          };
          this.dialogRef.close({ saved: true, album: newAlbum });
        } else {
          this.error.set(result.getError());
        }
      }
    } catch (err) {
      this.isUploadingArtwork.set(false);
      this.error.set(err instanceof Error ? err.message : 'Failed to save album');
    } finally {
      this.isSaving.set(false);
    }
  }
}

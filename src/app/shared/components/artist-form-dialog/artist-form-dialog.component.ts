/**
 * Create/edit artist profile dialog opened from public detail screens and
 * reusable by management views.
 *
 * Owns the artist Signal Forms model, optional profile-photo upload, and the
 * create/update database writes. Closes with an `ArtistFormDialogResult` so
 * the parent can refresh its profile.
 */
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormRoot, FormField, form, required, maxLength } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DbService } from '../../../core/services/db.service';
import { UploadService } from '../../../core/services/upload.service';
import { Artist, ArtistSocials } from '../../models/artist.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../../core/constants/theme.constants';
import { sanitizeForFirestore } from '../../../core/utils/sanitize';

/** Artist with its Firestore document ID. */
export interface ArtistWithId extends Artist {
  readonly id: string;
}

/** Data passed into the dialog: the artist being edited (or null to create). */
export interface ArtistFormDialogData {
  readonly artist: ArtistWithId | null;
}

/** Result emitted when the dialog closes. */
export interface ArtistFormDialogResult {
  readonly saved: boolean;
}

@Component({
  selector: 'app-artist-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  templateUrl: './artist-form-dialog.component.html',
  styleUrl: './artist-form-dialog.component.scss',
})
export class ArtistFormDialogComponent {
  private readonly dbService = inject(DbService);
  private readonly uploadService = inject(UploadService);
  private readonly dialogRef = inject<MatDialogRef<ArtistFormDialogComponent, ArtistFormDialogResult>>(MatDialogRef);
  private readonly data = inject<ArtistFormDialogData>(MAT_DIALOG_DATA);

  /** Whether the dialog edits an existing artist (false = create new). */
  readonly isEditMode = this.data.artist !== null;

  /** Current upload progress (0-100) for the profile photo. */
  readonly uploadProgress = this.uploadService.uploadProgress;

  readonly isSaving = signal(false);
  readonly isUploadingPhoto = signal(false);
  readonly error = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(this.data.artist?.photoURL ?? null);
  private readonly photoFile = signal<File | null>(null);

  readonly formData = signal({
    name: this.data.artist?.name ?? '',
    bio: this.data.artist?.bio ?? '',
    country: this.data.artist?.country ?? '',
    genre: this.data.artist?.genre ?? '',
    website: this.data.artist?.socials?.website ?? '',
    facebook: this.data.artist?.socials?.facebook ?? '',
    instagram: this.data.artist?.socials?.instagram ?? '',
    twitter: this.data.artist?.socials?.twitter ?? '',
    youtube: this.data.artist?.socials?.youtube ?? '',
    spotify: this.data.artist?.socials?.spotify ?? '',
    appleMusic: this.data.artist?.socials?.appleMusic ?? '',
    primaryColor: this.data.artist?.themeColors?.primary ?? DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: this.data.artist?.themeColors?.secondary ?? DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: this.data.artist?.themeColors?.tertiary ?? DEFAULT_PLATFORM_COLORS.tertiary,
  });

  readonly artistForm = form(this.formData, (p) => {
    required(p.name, { message: 'Artist name is required' });
    maxLength(p.bio, 2000, { message: 'Biography must be 2000 characters or fewer' });
  });

  /**
   * Closes the dialog without saving.
   */
  close(): void {
    this.dialogRef.close({ saved: false });
  }

  /**
   * Handles profile photo selection with preview.
   */
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.photoFile.set(input.files[0]);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photoPreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  /**
   * Saves a new or edited artist profile, uploading the photo first if selected.
   */
  async save(): Promise<void> {
    this.artistForm().markAsTouched();
    if (this.artistForm().invalid()) {
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    try {
      const data = this.formData();

      let photoURL: string | undefined;
      const photo = this.photoFile();
      if (photo) {
        this.isUploadingPhoto.set(true);
        const upload = await this.uploadService.uploadFile(photo);
        photoURL = upload.publicUrl;
        this.isUploadingPhoto.set(false);
      }

      const socials: ArtistSocials = {
        website: data.website.trim() || undefined,
        facebook: data.facebook.trim() || undefined,
        instagram: data.instagram.trim() || undefined,
        twitter: data.twitter.trim() || undefined,
        youtube: data.youtube.trim() || undefined,
        spotify: data.spotify.trim() || undefined,
        appleMusic: data.appleMusic.trim() || undefined,
      };

      const artistData: Partial<Artist> = {
        name: data.name.trim(),
        bio: data.bio.trim() || undefined,
        country: data.country.trim() || undefined,
        genre: data.genre.trim() || undefined,
        socials,
        themeColors: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          tertiary: data.tertiaryColor,
        },
        ...(photoURL ? { photoURL } : {}),
        updatedAt: new Date(),
      };

      if (this.isEditMode && this.data.artist) {
        const result = await this.dbService.update(
          'artists',
          this.data.artist.id,
          sanitizeForFirestore(artistData),
        );
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      } else {
        const artistId = this.dbService.generateId();
        const result = await this.dbService.createWithId(
          'artists',
          artistId,
          sanitizeForFirestore({
            ...artistData,
            artistId,
            createdAt: new Date(),
          } as Artist),
          { softDeletable: true },
        );
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      }
    } catch (err) {
      this.isUploadingPhoto.set(false);
      this.error.set(err instanceof Error ? err.message : 'Failed to save artist');
    } finally {
      this.isSaving.set(false);
    }
  }
}


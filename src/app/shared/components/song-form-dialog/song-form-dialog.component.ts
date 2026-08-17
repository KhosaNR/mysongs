/**
 * Create/edit song dialog opened from public detail screens (artist page,
 * album page, song page) and reusable by management views.
 *
 * Owns the song Signal Forms model, optional artwork + audio upload, and the
 * create/update database writes. Closes with a `SongFormDialogResult` so the
 * parent can refresh its track lists.
 */
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormRoot, FormField, form, required, validate, min } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { DbService } from '../../../core/services/db.service';
import { UploadService } from '../../../core/services/upload.service';
import { Song } from '../../models/song.interface';
import { Album } from '../../models/album.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../../core/constants/theme.constants';
import { sanitizeForFirestore } from '../../../core/utils/sanitize';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

/** Song with its Firestore document ID. */
export interface SongWithId extends Song {
  readonly id: string;
}

/** Album with its Firestore document ID. */
export interface AlbumWithId extends Album {
  readonly id: string;
}

/** Data passed into the dialog: the song being edited (or null to create). */
export interface SongFormDialogData {
  readonly song: SongWithId | null;
  readonly albums: AlbumWithId[];
  /** Artist owning a newly created song (create mode only). */
  readonly artistId?: string;
  /** Preferred song type for a newly created song (create mode only). */
  readonly defaultSongType?: 'album' | 'single';
}

/** Result emitted when the dialog closes. */
export interface SongFormDialogResult {
  readonly saved: boolean;
}

type SongType = 'album' | 'single';

@Component({
  selector: 'app-song-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormRoot,
    FormField,
    FieldErrorsComponent,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './song-form-dialog.component.html',
  styleUrl: './song-form-dialog.component.scss',
})
export class SongFormDialogComponent {
  private readonly dbService = inject(DbService);
  private readonly uploadService = inject(UploadService);
  private readonly dialogRef = inject<MatDialogRef<SongFormDialogComponent, SongFormDialogResult>>(MatDialogRef);
  private readonly data = inject<SongFormDialogData>(MAT_DIALOG_DATA);

  /** Whether the dialog edits an existing song (false = create new). */
  readonly isEditMode = this.data.song !== null;

  readonly albums = computed(() => this.data.albums);

  /** Current upload progress (0-100) for artwork/audio. */
  readonly uploadProgress = this.uploadService.uploadProgress;

  readonly isSaving = signal(false);
  readonly isUploadingArtwork = signal(false);
  readonly isUploadingAudio = signal(false);
  readonly error = signal<string | null>(null);
  readonly artworkPreview = signal<string | null>(this.data.song?.artworkUrl ?? null);
  private readonly artworkFile = signal<File | null>(null);
  protected readonly audioFile = signal<File | null>(null);

  readonly formData = signal({
    title: this.data.song?.title ?? '',
    featuredArtists: this.data.song?.featuredArtists ?? '',
    producers: this.data.song?.producers ?? '',
    songType: this.data.song
      ? ((this.data.song.albumId ? 'album' : 'single') as SongType)
      : ((this.data.defaultSongType ?? 'single') as SongType),
    albumId: this.data.song?.albumId ?? '',
    trackNumber: this.data.song?.trackNumber ?? 1,
    duration: this.data.song?.duration ?? 0,
    genre: this.data.song?.genre ?? '',
    tags: (this.data.song?.tags ?? []).join(', '),
    lyrics: this.data.song?.lyrics ?? '',
    youtubeVideoId: this.data.song?.youtubeVideoId ?? '',
    releaseDate: this.data.song?.releaseDate
      ? new Date(this.data.song.releaseDate).toISOString().slice(0, 10)
      : '',
    writtenBy: this.data.song?.writtenBy ?? '',
    priceZAR: this.data.song?.priceZAR ?? 0,
    minimumPriceZAR: this.data.song?.minimumPriceZAR ?? 0,
    primaryColor: this.data.song?.themeColors?.primary ?? DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: this.data.song?.themeColors?.secondary ?? DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: this.data.song?.themeColors?.tertiary ?? DEFAULT_PLATFORM_COLORS.tertiary,
  });

  readonly songForm = form(this.formData, (p) => {
    required(p.title, { message: 'Song title is required' });
    validate(p.albumId, (ctx) => {
      const isAlbum = ctx.valueOf(p.songType) === 'album';
      if (isAlbum && !ctx.value()) {
        return { kind: 'required', message: 'Select an album for this song' };
      }
      return undefined;
    });
    required(p.duration, {
      message: 'Duration is required',
      when: () => !this.isEditMode,
    });
    min(p.duration, 0, { message: 'Duration cannot be negative' });
    min(p.trackNumber, 1, { message: 'Track number must be at least 1' });
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

  /**
   * Closes the dialog without saving.
   */
  close(): void {
    this.dialogRef.close({ saved: false });
  }

  /**
   * Handles artwork file selection with preview.
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
   * Handles audio file selection (optional replacement in edit mode).
   */
  onAudioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.audioFile.set(input.files[0]);
    }
  }

  /**
   * Records the selected album and inherits its theme colors.
   *
   * @param event - Native change event carrying the selected album ID
   */
  onAlbumChange(event: Event): void {
    const albumId = (event.target as HTMLSelectElement).value;
    this.formData.update((data) => ({ ...data, albumId }));
    const album = this.albums().find((a) => a.id === albumId);
    if (album?.themeColors) {
      this.formData.update((data) => ({
        ...data,
        primaryColor: album.themeColors?.primary ?? data.primaryColor,
        secondaryColor: album.themeColors?.secondary ?? data.secondaryColor,
        tertiaryColor: album.themeColors?.tertiary ?? data.tertiaryColor,
      }));
    }
  }

  /**
   * Saves a new or edited song, uploading artwork/audio first if selected.
   */
  async save(): Promise<void> {
    this.songForm().markAsTouched();
    if (this.songForm().invalid()) {
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    try {
      const data = this.formData();

      let artworkUrl: string | undefined;
      const artwork = this.artworkFile();
      if (artwork) {
        this.isUploadingArtwork.set(true);
        const upload = await this.uploadService.uploadFile(artwork);
        artworkUrl = upload.publicUrl;
        this.isUploadingArtwork.set(false);
      }

      let streamUrl = this.data.song?.streamUrl;
      let securePath = this.data.song?.securePath;
      const audio = this.audioFile();
      if (audio) {
        this.isUploadingAudio.set(true);
        const upload = await this.uploadService.uploadFile(audio);
        streamUrl = upload.publicUrl;
        securePath = upload.objectKey;
        this.isUploadingAudio.set(false);
      }

      if (!this.isEditMode && (!streamUrl || !securePath)) {
        throw new Error('Audio file is required for a new song.');
      }

      const songData: Partial<Song> = {
        title: data.title.trim(),
        featuredArtists: data.featuredArtists.trim() || undefined,
        producers: data.producers.trim() || undefined,
        albumId: data.songType === 'album' ? data.albumId : undefined,
        trackNumber: data.songType === 'album' ? data.trackNumber : undefined,
        duration: data.duration || undefined,
        genre: data.genre.trim() || undefined,
        tags: data.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t),
        lyrics: data.lyrics.trim() || undefined,
        youtubeVideoId: data.youtubeVideoId.trim() || undefined,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
        writtenBy: data.writtenBy.trim() || undefined,
        priceZAR: data.priceZAR,
        minimumPriceZAR: data.minimumPriceZAR > 0 ? data.minimumPriceZAR : undefined,
        themeColors: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          tertiary: data.tertiaryColor,
        },
        ...(artworkUrl ? { artworkUrl } : {}),
        ...(streamUrl ? { streamUrl } : {}),
        ...(securePath ? { securePath } : {}),
        updatedAt: new Date(),
      };

      if (this.isEditMode && this.data.song) {
        const result = await this.dbService.update(
          'songs',
          this.data.song.id,
          sanitizeForFirestore(songData),
        );
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      } else {
        const artistId = this.data.artistId;
        if (!artistId) {
          this.error.set('No artist ID provided for this song.');
          return;
        }
        const songId = this.dbService.generateId();
        const result = await this.dbService.createWithId(
          'songs',
          songId,
          sanitizeForFirestore({
            ...songData,
            songId,
            artistId,
            createdAt: new Date(),
          } as Song),
          { softDeletable: true },
        );
        if (result.isSuccess()) {
          this.dialogRef.close({ saved: true });
        } else {
          this.error.set(result.getError());
        }
      }
    } catch (err) {
      this.isUploadingArtwork.set(false);
      this.isUploadingAudio.set(false);
      this.error.set(err instanceof Error ? err.message : 'Failed to save song');
    } finally {
      this.isSaving.set(false);
    }
  }
}


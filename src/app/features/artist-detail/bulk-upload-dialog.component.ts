/**
 * Bulk ("full album") upload dialog for artists.
 *
 * Accepts many audio files at once, pre-fills each track's details from the
 * file's embedded tags, then uploads sequentially and writes the Firestore
 * documents per track. Media uploads are committed **before** the matching
 * `songs` document is written, so a failed upload can never leave an orphaned
 * document behind.
 *
 * Files are uploaded one at a time on purpose: the Worker allows 30 requests
 * per minute per IP and each file costs two, so sequential uploads stay inside
 * the window and `UploadService`'s 429 handling only has to cover bursts.
 */
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbService } from '../../core/services/db.service';
import { AuthService } from '../../core/services/auth.service';
import { UploadService } from '../../core/services/upload.service';
import { Album } from '../../shared/models/album.interface';
import { Song } from '../../shared/models/song.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../core/constants/theme.constants';
import { formatDuration } from '../../core/utils/format-duration';

/** Existing album offered for selection, with its Firestore document id. */
export interface BulkAlbumOption {
  readonly id: string;
  readonly title: string;
}

/** Album a batch is locked to, hiding the title input entirely. */
export interface BulkLockedAlbum {
  readonly id: string;
  readonly title: string;
}

/** Dialog data: the album list plus an optional album the batch is locked to. */
export interface BulkUploadDialogData {
  readonly albums?: BulkAlbumOption[];
  readonly lockedAlbum?: BulkLockedAlbum;
}

/** Progress of a single file in the batch. */
export type BulkTrackStatus = 'pending' | 'uploading' | 'waiting' | 'done' | 'failed';

/** One track being staged for upload, with the values read from its file. */
export interface BulkTrackDraft {
  readonly file: File;
  title: string;
  albumArtist: string;
  genre: string;
  trackNumber: number;
  durationSeconds: number;
  status: BulkTrackStatus;
  error?: string;
}

/** Result emitted when the dialog closes. */
export interface BulkUploadResult {
  readonly saved: boolean;
  readonly createdCount: number;
}

@Component({
  selector: 'app-bulk-upload-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './bulk-upload-dialog.component.html',
  styleUrl: './bulk-upload-dialog.component.scss',
})
export class BulkUploadDialogComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);
  private readonly dialogRef = inject<MatDialogRef<BulkUploadDialogComponent, BulkUploadResult>>(
    MatDialogRef,
  );

  /**
   * Existing albums the batch may be filed under, when set as a component
   * input (unit tests). Production opens the dialog via
   * `MatDialog.open(..., { data: { albums } })`, which feeds `MAT_DIALOG_DATA`
   * and never populates component inputs.
   */
  readonly albumsInput = input<BulkAlbumOption[]>([]);

  private readonly dialogData = inject<BulkUploadDialogData>(MAT_DIALOG_DATA, { optional: true });

  /**
   * Album the batch is locked to. When set, the title input is hidden and
   * every track is filed under this album — used by the Add Songs chooser.
   */
  readonly lockedAlbum = computed(() => this.dialogData?.lockedAlbum ?? null);

  /** Whether the batch is locked to one album. */
  readonly isLocked = computed(() => this.lockedAlbum() !== null);

  /**
   * Existing albums the batch may be filed under.
   *
   * Reads the `albums` component input first (unit tests) and falls back to
   * `MAT_DIALOG_DATA` (production `MatDialog.open(..., { data: { albums } })`,
   * which never populates component inputs).
   */
  readonly albums = computed(() => this.albumsInput().length > 0
    ? this.albumsInput()
    : (this.dialogData?.albums ?? this.albumsInput()));

  readonly tracks = signal<BulkTrackDraft[]>([]);
  readonly albumTitle = signal('');
  readonly isReading = signal(false);
  readonly isUploading = signal(false);
  readonly error = signal<string | null>(null);

  readonly uploadProgress = this.uploadService.uploadProgress;
  readonly isRateLimited = this.uploadService.isRateLimited;

  /** Platform duration formatter, shared so the format cannot drift. */
  readonly formatDuration = formatDuration;

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');

  readonly completedCount = computed(
    () => this.tracks().filter((track) => track.status === 'done').length,
  );
  readonly failedCount = computed(
    () => this.tracks().filter((track) => track.status === 'failed').length,
  );
  readonly hasTracks = computed(() => this.tracks().length > 0);
  readonly canSubmit = computed(
    () =>
      this.hasTracks() &&
      (this.isLocked() || this.albumTitle().trim().length > 0) &&
      !this.isUploading(),
  );

  /** Human-readable status for a file row. */
  statusLabel(track: BulkTrackDraft): string {
    switch (track.status) {
      case 'uploading':
        return 'Uploading';
      case 'waiting':
        return 'Rate limited — resuming shortly';
      case 'done':
        return 'Uploaded';
      case 'failed':
        return 'Failed';
      default:
        return 'Ready';
    }
  }

  /** Closes without uploading anything. */
  close(): void {
    this.dialogRef.close({ saved: false, createdCount: 0 });
  }

  /**
   * Reads metadata for a freshly selected set of files and stages them as drafts.
   *
   * @param event - Native change event from the file input
   */
  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) =>
      file.type.startsWith('audio/'),
    );

    if (files.length === 0) {
      this.error.set('Choose at least one audio file.');
      return;
    }

    this.error.set(null);
    this.isReading.set(true);

    try {
      const drafts = await Promise.all(
        files.map(async (file, index) => {
          const tags = await this.uploadService.readAudioMetadata(file);
          return {
            file,
            title: tags.title ?? this.stripExtension(file.name),
            albumArtist: tags.albumArtist ?? '',
            genre: tags.genre ?? '',
            trackNumber: tags.trackNumber ?? index + 1,
            durationSeconds: tags.durationSeconds ?? 0,
            status: 'pending' as BulkTrackStatus,
          };
        }),
      );

      this.tracks.set(drafts);

      const sharedAlbum = drafts.find((draft) => draft.albumArtist)?.albumArtist;
      if (!this.albumTitle().trim() && sharedAlbum) {
        this.albumTitle.set(sharedAlbum);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not read audio metadata');
    } finally {
      this.isReading.set(false);
    }
  }

  /** Drops a single staged file. */
  removeTrack(index: number): void {
    this.tracks.update((tracks) => tracks.filter((_, i) => i !== index));
  }

  /** Updates one editable field on a staged track. */
  updateTrack(index: number, field: 'title' | 'genre', value: string): void {
    this.tracks.update((tracks) =>
      tracks.map((track, i) => (i === index ? { ...track, [field]: value } : track)),
    );
  }

  /** Re-uploads only the tracks that previously failed. */
  retryFailed(): void {
    this.tracks.update((tracks) =>
      tracks.map((track) =>
        track.status === 'failed' ? { ...track, status: 'pending', error: undefined } : track,
      ),
    );
    void this.runUpload();
  }

  /** Validates the batch and starts the sequential upload. */
  async submit(): Promise<void> {
    if (!this.canSubmit()) {
      this.error.set(
        this.isLocked()
          ? 'Add at least one track.'
          : 'Give the album a title and add at least one track.',
      );
      return;
    }
    await this.runUpload();
  }

  /**
   * Uploads every pending track, writing each `songs` document only after its
   * media upload has succeeded. A failure on one track never aborts the rest.
   */
  private async runUpload(): Promise<void> {
    const artistId = this.artistId();
    if (!artistId) {
      this.error.set('No artist ID is assigned to this account.');
      return;
    }

    this.isUploading.set(true);
    this.error.set(null);

    const albumId = await this.resolveAlbumId(artistId);
    if (!albumId) {
      this.isUploading.set(false);
      return;
    }

    let created = 0;

    for (const track of this.pendingTracks()) {
      this.patchTrack(track, { status: 'uploading', error: undefined });

      try {
        const upload = await this.uploadService.uploadFile(track.file);

        // Media is in R2 — only now is it safe to write the document.
        const songId = this.dbService.generateId();
        const result = await this.dbService.createWithId<Song>(
          'songs',
          songId,
          {
            songId,
            artistId,
            albumId,
            title: track.title.trim() || this.stripExtension(track.file.name),
            trackNumber: track.trackNumber,
            duration: track.durationSeconds || undefined,
            genre: track.genre.trim() || undefined,
            featuredArtists: track.albumArtist.trim() || undefined,
            streamUrl: upload.publicUrl,
            securePath: upload.objectKey,
            priceZAR: 0,
            themeColors: { ...DEFAULT_PLATFORM_COLORS },
            createdAt: new Date(),
          },
          { softDeletable: true },
        );

        if (result.isFailure()) {
          this.patchTrack(track, { status: 'failed', error: result.getError() });
          continue;
        }

        created += 1;
        this.patchTrack(track, { status: 'done' });
      } catch (err) {
        this.patchTrack(track, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      }
    }

    this.isUploading.set(false);

    if (created === 0) {
      this.error.set('No tracks could be uploaded. Check the failures below and retry.');
      return;
    }

    this.dialogRef.close({ saved: true, createdCount: created });
  }

  /** Tracks still awaiting upload. */
  private pendingTracks(): BulkTrackDraft[] {
    return this.tracks().filter((track) => track.status === 'pending');
  }

  /**
   * Resolves the album the batch belongs to, creating it on first use.
   * A locked batch skips the lookup entirely and returns the locked id.
   *
   * @param artistId - Owning artist
   * @returns The album document id, or null when it could not be created
   */
  private async resolveAlbumId(artistId: string): Promise<string | null> {
    const locked = this.lockedAlbum();
    if (locked) {
      return locked.id;
    }

    const title = this.albumTitle().trim();

    const existing = this.albums().find(
      (album) => album.title.toLowerCase() === title.toLowerCase(),
    );
    if (existing) {
      return existing.id;
    }

    const albumId = this.dbService.generateId();
    const result = await this.dbService.createWithId<Album>(
      'albums',
      albumId,
      { albumId, artistId, title, priceZAR: 0, createdAt: new Date() },
      { softDeletable: true },
    );

    if (result.isFailure()) {
      this.error.set(result.getError());
      return null;
    }

    return albumId;
  }

  /**
   * Applies a patch to one track, matched by file identity.
   *
   * @param target - Track to update
   * @param patch - Fields to change
   */
  private patchTrack(target: BulkTrackDraft, patch: Partial<BulkTrackDraft>): void {
    this.tracks.update((tracks) =>
      tracks.map((track) => (track.file === target.file ? { ...track, ...patch } : track)),
    );
  }

  /**
   * Strips the extension from a filename for use as a fallback title.
   *
   * @param name - Source filename
   * @returns Filename without its extension
   */
  private stripExtension(name: string): string {
    return name.replace(/\.[^.]+$/, '').trim();
  }
}
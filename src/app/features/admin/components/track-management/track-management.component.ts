import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required, min, readonly, validate } from '@angular/forms/signals';
import { DbService } from '../../../../core/services/db.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UploadService } from '../../../../core/services/upload.service';
import { USER_ROLE } from '../../../../core/constants/navigation.constants';
import { DEFAULT_PLATFORM_COLORS } from '../../../../core/constants/theme.constants';
import { environment } from '../../../../../environments/environment';
import { FieldErrorsComponent } from '../../../../shared/components/field-errors/field-errors.component';

interface Track {
  id: string;
  title: string;
  artistId: string;
  albumId?: string;
  trackNumber?: number;
  duration: number;
  genre: string[];
  tags: string[];
  lyrics?: string;
  youtubeVideoId?: string;
  streamUrl?: string;
  securePath?: string;
  artworkUrl?: string;
  priceZAR: number;
  minimumPriceZAR?: number;
  themeColors?: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  isActive: boolean;
  createdAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

@Component({
  selector: 'app-track-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './track-management.component.html',
  styleUrl: './track-management.component.scss',
})
export class TrackManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);

  readonly tracks = signal<Track[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showUploadForm = signal(false);
  readonly uploadProgress = signal(0);
  readonly isUploading = signal(false);
  readonly isReadingMetadata = signal(false);
  readonly artworkPreview = signal<string | null>(null);
  readonly isEditMode = signal(false);
  readonly editingTrackId = signal<string | null>(null);
  readonly showDeleted = signal(false);

  readonly currentUser = this.authService.currentUser;
  readonly isArtist = computed(() => this.currentUser()?.role === USER_ROLE.ARTIST);
  readonly isAdmin = computed(() => this.currentUser()?.role === USER_ROLE.ADMIN);

  readonly uploadFormData = signal({
    title: '',
    artistId: '',
    albumId: '',
    trackNumber: 1,
    duration: 0,
    genre: '',
    tags: '',
    lyrics: '',
    youtubeVideoId: '',
    priceZAR: 0,
    minimumPriceZAR: 0,
    primaryColor: DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
    audioFile: null as File | null,
    artworkFile: null as File | null,
  });

  readonly trackForm = form(this.uploadFormData, (p) => {
    required(p.title, { message: 'Track title is required' });
    required(p.artistId, { message: 'Artist ID is required' });
    // Artists never choose their own artist ID; it is auto-filled from their profile.
    readonly(p.artistId, { when: () => this.isArtist() });
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

  constructor() {
    this.loadTracks();
  }

  async loadTracks(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.dbService.getCollection<Track>('songs', {
        constraints: [],
      });

      if (result.isSuccess()) {
        const tracksData = result.getData();
        const user = this.currentUser();
        let filtered =
          this.isArtist() && user?.artistId
            ? tracksData.filter((doc) => doc.data.artistId === user.artistId)
            : tracksData;

        if (!this.showDeleted()) {
          filtered = filtered.filter((doc) => !doc.data.isDeleted);
        }

        this.tracks.set(filtered.map((doc) => doc.data));
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load tracks');
    } finally {
      this.isLoading.set(false);
    }
  }

  openUploadForm(): void {
    const user = this.currentUser();
    const artistId = user?.artistId || '';
    this.uploadFormData.update((data) => ({ ...data, artistId }));
    this.trackForm().reset();
    this.isEditMode.set(false);
    this.editingTrackId.set(null);
    this.showUploadForm.set(true);
  }

  openEditForm(track: Track): void {
    this.uploadFormData.set({
      title: track.title,
      artistId: track.artistId,
      albumId: track.albumId || '',
      trackNumber: track.trackNumber || 1,
      duration: track.duration,
      genre: track.genre.join(', '),
      tags: track.tags.join(', '),
      lyrics: track.lyrics || '',
      youtubeVideoId: track.youtubeVideoId || '',
      priceZAR: track.priceZAR,
      minimumPriceZAR: track.minimumPriceZAR ?? 0,
      primaryColor: track.themeColors?.primary || DEFAULT_PLATFORM_COLORS.primary,
      secondaryColor: track.themeColors?.secondary || DEFAULT_PLATFORM_COLORS.secondary,
      tertiaryColor: track.themeColors?.tertiary || DEFAULT_PLATFORM_COLORS.tertiary,
      audioFile: null,
      artworkFile: null,
    });
    this.trackForm().reset();
    this.isEditMode.set(true);
    this.editingTrackId.set(track.id);
    this.artworkPreview.set(track.artworkUrl || null);
    this.showUploadForm.set(true);
  }

  closeUploadForm(): void {
    this.showUploadForm.set(false);
    this.isEditMode.set(false);
    this.editingTrackId.set(null);
    this.uploadFormData.set({
      title: '',
      artistId: '',
      albumId: '',
      trackNumber: 1,
      duration: 0,
      genre: '',
      tags: '',
      lyrics: '',
      youtubeVideoId: '',
      priceZAR: 0,
      minimumPriceZAR: 0,
      primaryColor: DEFAULT_PLATFORM_COLORS.primary,
      secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
      tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
      audioFile: null,
      artworkFile: null,
    });
    this.trackForm().reset();
    this.uploadProgress.set(0);
    this.artworkPreview.set(null);
  }

  onFileSelected(event: Event, type: 'audio' | 'artwork'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (type === 'audio') {
        this.uploadFormData.update((data) => ({ ...data, audioFile: file }));
        this.isReadingMetadata.set(true);
        this.uploadService
          .readAudioDuration(file)
          .then((duration) => {
            this.uploadFormData.update((data) => ({ ...data, duration }));
          })
          .catch(() => {
            this.uploadFormData.update((data) => ({ ...data, duration: 0 }));
          })
          .finally(() => {
            this.isReadingMetadata.set(false);
          });
      } else {
        this.uploadFormData.update((data) => ({ ...data, artworkFile: file }));
        const reader = new FileReader();
        reader.onload = (e) => {
          this.artworkPreview.set(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  /**
   * Formats a duration in seconds as mm:ss for table display.
   */
  formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Uploads a file to R2 via the Worker and returns the public URL.
   */
  private async uploadFile(file: File): Promise<{ objectKey: string; publicUrl: string } | null> {
    try {
      const workerUrl = environment.api.workerUrl;
      const uploadUrlResponse = await fetch(
        `${workerUrl}/uploads?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&fileSize=${file.size}`,
      );

      if (!uploadUrlResponse.ok) {
        const errBody = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error(errBody['error'] || 'Failed to get upload URL');
      }

      const { uploadUrl } = await uploadUrlResponse.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errBody = await uploadResponse.json().catch(() => ({}));
        throw new Error(errBody['error'] || 'Failed to upload file');
      }

      const result = await uploadResponse.json();
      return {
        objectKey: result.objectKey,
        publicUrl: result.publicUrl,
      };
    } catch (error) {
      console.error('Upload failed:', error);
      this.error.set(error instanceof Error ? error.message : 'Upload failed');
      return null;
    }
  }

  editTrack(track: Track): void {
    this.openEditForm(track);
  }

  async deleteTrack(track: Track): Promise<void> {
    if (
      !confirm(
        `Are you sure you want to delete "${track.title}"? This action can be undone from the admin panel.`,
      )
    ) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.dbService.softDelete('songs', track.id);
      if (result.isSuccess()) {
        await this.loadTracks();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete track');
    } finally {
      this.isLoading.set(false);
    }
  }

  async restoreTrack(track: Track): Promise<void> {
    if (!confirm(`Restore "${track.title}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.dbService.restore('songs', track.id);
      if (result.isSuccess()) {
        await this.loadTracks();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to restore track');
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitUpload(): Promise<void> {
    this.trackForm().markAsTouched();
    if (this.trackForm().invalid()) {
      return;
    }

    const formData = this.uploadFormData();

    this.isUploading.set(true);
    this.error.set(null);
    this.uploadProgress.set(0);

    try {
      let streamUrl: string | undefined;
      let securePath: string | undefined;
      let artworkUrl: string | undefined;

      if (this.isEditMode()) {
        streamUrl = this.editingTrackId()
          ? this.tracks().find((t) => t.id === this.editingTrackId())?.streamUrl
          : undefined;
        securePath = this.editingTrackId()
          ? this.tracks().find((t) => t.id === this.editingTrackId())?.securePath
          : undefined;
        artworkUrl = this.editingTrackId()
          ? this.tracks().find((t) => t.id === this.editingTrackId())?.artworkUrl
          : undefined;
      }

      if (formData.audioFile) {
        this.uploadProgress.set(10);
        const audioResult = await this.uploadFile(formData.audioFile);
        if (!audioResult) {
          throw new Error('Failed to upload audio file');
        }
        streamUrl = audioResult.publicUrl;
        securePath = audioResult.objectKey;
      }

      this.uploadProgress.set(40);

      if (formData.artworkFile) {
        this.uploadProgress.set(60);
        const artworkResult = await this.uploadFile(formData.artworkFile);
        if (!artworkResult) {
          throw new Error('Failed to upload artwork');
        }
        artworkUrl = artworkResult.publicUrl;
      }

      this.uploadProgress.set(80);

      const trackData: Partial<Track> = {
        title: formData.title.trim(),
        artistId: formData.artistId.trim(),
        albumId: formData.albumId.trim() || undefined,
        trackNumber: formData.trackNumber,
        duration: formData.duration || undefined,
        genre: formData.genre
          .split(',')
          .map((g) => g.trim())
          .filter((g) => g),
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t),
        lyrics: formData.lyrics.trim() || undefined,
        youtubeVideoId: formData.youtubeVideoId.trim() || undefined,
        streamUrl: streamUrl || '',
        securePath: securePath || '',
        artworkUrl,
        priceZAR: formData.priceZAR,
        minimumPriceZAR: formData.minimumPriceZAR > 0 ? formData.minimumPriceZAR : undefined,
        themeColors: {
          primary: formData.primaryColor,
          secondary: formData.secondaryColor,
          tertiary: formData.tertiaryColor,
        },
        isActive: true,
      };

      if (this.isEditMode() && this.editingTrackId()) {
        const result = await this.dbService.update('songs', this.editingTrackId()!, trackData);
        this.uploadProgress.set(100);

        if (result.isSuccess()) {
          this.closeUploadForm();
          await this.loadTracks();
        } else {
          this.error.set(result.getError());
        }
      } else {
        const songId = this.dbService.generateId();
        const result = await this.dbService.createWithId(
          'songs',
          songId,
          { ...trackData, songId, createdAt: new Date() } as Track,
          { softDeletable: true },
        );
        this.uploadProgress.set(100);

        if (result.isSuccess()) {
          this.closeUploadForm();
          await this.loadTracks();
        } else {
          this.error.set(result.getError());
        }
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      this.isUploading.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }
}

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required, validate } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { where } from '@angular/fire/firestore';
import { DbService } from '../../../core/services/db.service';
import { AuthService } from '../../../core/services/auth.service';
import { UploadService } from '../../../core/services/upload.service';
import { Album } from '../../../shared/models/album.interface';
import { Artist, ThemeColors } from '../../../shared/models/artist.interface';
import { Song } from '../../../shared/models/song.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../../core/constants/theme.constants';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';

export interface SongWithId extends Song {
  readonly id: string;
}

interface AlbumWithId extends Album {
  readonly id: string;
}

type SongType = 'album' | 'single';

/**
 * Artist song/single management view with audio upload to R2.
 */
@Component({
  selector: 'app-song-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './song-management.component.html',
  styleUrl: './song-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);
  private readonly route = inject(ActivatedRoute);

  readonly songs = signal<SongWithId[]>([]);
  readonly albums = signal<AlbumWithId[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isUploadingAudio = signal(false);
  readonly isReadingMetadata = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly isEditMode = signal(false);
  readonly editingSongId = signal<string | null>(null);
  readonly showDeleted = signal(false);

  readonly formData = signal({
    title: '',
    featuredArtists: '',
    producers: '',
    songType: 'album' as SongType,
    albumId: '',
    trackNumber: 1,
    duration: 0,
    genre: '',
    tags: '',
    lyrics: '',
    youtubeVideoId: '',
    releaseDate: '',
    writtenBy: '',
    primaryColor: DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
    songFile: null as File | null,
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
    required(p.songFile, {
      message: 'Audio file is required for new songs',
      when: () => !this.isEditMode(),
    });
  });

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');
  readonly uploadProgress = this.uploadService.uploadProgress;

  /** The artist's own brand palette, used as the middle fallback for new tracks. */
  private readonly artistThemeColors = signal<ThemeColors | null>(null);

  private readonly defaultForm = {
    title: '',
    featuredArtists: '',
    producers: '',
    songType: 'album' as SongType,
    albumId: '',
    trackNumber: 1,
    duration: 0,
    genre: '',
    tags: '',
    lyrics: '',
    youtubeVideoId: '',
    releaseDate: '',
    writtenBy: '',
    primaryColor: DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
    songFile: null as File | null,
  };

  constructor() {
    this.loadSongs();
    this.initFromRoute();
    void this.loadArtistTheme();
  }

  /**
   * Loads the artist's brand palette once so new songs can inherit it when the
   * selected album carries no theme colors of its own.
   */
  private async loadArtistTheme(): Promise<void> {
    const id = this.artistId();
    if (!id) return;
    try {
      const result = await this.dbService.getDocument<Artist>('artists', id);
      if (result.isSuccess()) {
        this.artistThemeColors.set(result.getData().data.themeColors ?? null);
      }
    } catch {
      // Non-blocking — platform defaults remain the final fallback.
    }
  }

  /**
   * Copies the selected album's theme colors into the song form so a new track
   * inherits its parent album's branding.
   *
   * Fallback chain: album theme → artist brand → platform defaults.
   *
   * @param albumId - The selected album's document ID
   */
  applyAlbumTheme(albumId: string): void {
    const album = this.albums().find((a) => a.id === albumId);
    const colors = album?.themeColors ?? this.artistThemeColors() ?? DEFAULT_PLATFORM_COLORS;
    this.formData.update((data) => ({
      ...data,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      tertiaryColor: colors.tertiary,
    }));
  }

  /**
   * Template handler for the Album <select> change event — records the
   * selection and refreshes the theme swatches from that album.
   *
   * @param event - Native change event carrying the selected album ID
   */
  onAlbumChange(event: Event): void {
    const albumId = (event.target as HTMLSelectElement).value;
    this.formData.update((data) => ({ ...data, albumId }));
    this.applyAlbumTheme(albumId);
  }

  /**
   * Reads the ?albumId= query parameter and, when present, opens the
   * create form pre-wired to that album.
   */
  private initFromRoute(): void {
    const albumId = this.route.snapshot.queryParamMap.get('albumId');
    if (albumId) {
      this.loadAlbums().then(() => {
        this.openCreateFormForAlbum(albumId);
      });
    } else {
      this.loadAlbums();
    }
  }

  /**
   * Opens the create form pre-selecting the given album.
   */
  openCreateFormForAlbum(albumId: string): void {
    this.formData.set({
      ...this.defaultForm,
      songType: 'album',
      albumId,
      trackNumber: this.songs().filter((s) => s.albumId === albumId).length + 1,
    });
    this.applyAlbumTheme(albumId);
    this.songForm().reset();
    this.isEditMode.set(false);
    this.editingSongId.set(null);
    this.showForm.set(true);
  }

  // --- Placeholder implementations, filled below ---

  async loadSongs(): Promise<void> {
    const id = this.artistId();
    if (!id) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.getCollection<Song>('songs', {
        constraints: [where('artistId', '==', id)],
      });
      if (result.isSuccess()) {
        let songsData = result.getData().map((doc) => ({ ...doc.data, id: doc.id }) as SongWithId);
        if (!this.showDeleted()) {
          songsData = songsData.filter((song) => !song.isDeleted);
        }
        this.songs.set(songsData);
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load songs');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadAlbums(): Promise<void> {
    const id = this.artistId();
    if (!id) return;
    try {
      const result = await this.dbService.getCollection<Album>('albums', {
        constraints: [where('artistId', '==', id)],
      });
      if (result.isSuccess()) {
        const albumsData = result
          .getData()
          .map((doc) => ({ ...doc.data, id: doc.id }) as AlbumWithId)
          .filter((album) => !album.isDeleted);
        this.albums.set(albumsData);
      }
    } catch {
      // Non-blocking
    }
  }
  openCreateForm(): void {
    this.formData.set({
      ...this.defaultForm,
      albumId: this.albums()[0]?.id || '',
      trackNumber:
        this.albums().length > 0
          ? this.songs().filter((s) => s.albumId === this.albums()[0]?.id).length + 1
          : 1,
    });
    if (this.albums()[0]?.id) {
      this.applyAlbumTheme(this.albums()[0].id);
    }
    this.songForm().reset();
    this.isEditMode.set(false);
    this.editingSongId.set(null);
    this.showForm.set(true);
  }
  openEditForm(song: SongWithId): void {
    this.formData.set({
      title: song.title || '',
      featuredArtists: song.featuredArtists || '',
      producers: song.producers || '',
      songType: song.albumId ? 'album' : 'single',
      albumId: song.albumId || '',
      trackNumber: song.trackNumber || 1,
      duration: song.duration || 0,
      genre: song.genre || '',
      tags: song.tags?.join(', ') || '',
      lyrics: song.lyrics || '',
      youtubeVideoId: song.youtubeVideoId || '',
      releaseDate: song.releaseDate ? new Date(song.releaseDate).toISOString().slice(0, 10) : '',
      writtenBy: song.writtenBy || '',
      primaryColor: song.themeColors?.primary || DEFAULT_PLATFORM_COLORS.primary,
      secondaryColor: song.themeColors?.secondary || DEFAULT_PLATFORM_COLORS.secondary,
      tertiaryColor: song.themeColors?.tertiary || DEFAULT_PLATFORM_COLORS.tertiary,
      songFile: null,
    });
    this.songForm().reset();
    this.isEditMode.set(true);
    this.editingSongId.set(song.id);
    this.showForm.set(true);
  }

  async onAudioSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      if (input.files[0].size > 20 * 1024 * 1024) {
        this.error.set('Audio file is too large. Please select a file smaller than 20MB.');
        return;
      }
      const file = input.files[0];
      this.formData.update((data) => ({ ...data, songFile: file }));
      this.isReadingMetadata.set(true);
      try {
        const duration = await this.uploadService.readAudioDuration(file);
        this.formData.update((data) => ({ ...data, duration }));
      } catch (err) {
        this.error.set(err instanceof Error ? err.message : 'Could not read audio duration');
      } finally {
        this.isReadingMetadata.set(false);
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

  async saveSong(): Promise<void> {
    this.songForm().markAsTouched();
    if (this.songForm().invalid()) {
      return;
    }

    const id = this.artistId();
    const data = this.formData();

    if (!id) {
      this.error.set('No artist ID assigned to this account.');
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    try {
      let streamUrl: string | undefined;
      let securePath: string | undefined;

      if (this.isEditMode() && this.editingSongId()) {
        const existing = this.songs().find((s) => s.id === this.editingSongId());
        streamUrl = existing?.streamUrl;
        securePath = existing?.securePath;
      }

      const file = this.formData().songFile;
      if (file) {
        this.isUploadingAudio.set(true);
        const upload = await this.uploadService.uploadFile(file);
        streamUrl = upload.publicUrl;
        securePath = upload.objectKey;
        this.isUploadingAudio.set(false);
      }

      if (!this.isEditMode() && (!streamUrl || !securePath)) {
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
        themeColors: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          tertiary: data.tertiaryColor,
        },
        ...(streamUrl ? { streamUrl } : {}),
        ...(securePath ? { securePath } : {}),
        updatedAt: new Date(),
      };

      if (this.isEditMode() && this.editingSongId()) {
        const result = await this.dbService.update('songs', this.editingSongId()!, songData);
        if (result.isSuccess()) {
          this.closeForm();
          await this.loadSongs();
        } else {
          this.error.set(result.getError());
        }
      } else {
        const songId = this.dbService.generateId();
        const result = await this.dbService.createWithId(
          'songs',
          songId,
          {
            ...songData,
            songId,
            artistId: id,
            createdAt: new Date(),
          } as Song,
          { softDeletable: true },
        );
        if (result.isSuccess()) {
          this.closeForm();
          await this.loadSongs();
        } else {
          this.error.set(result.getError());
        }
      }
    } catch (err) {
      this.isUploadingAudio.set(false);
      this.error.set(err instanceof Error ? err.message : 'Failed to save song');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteSong(song: SongWithId): Promise<void> {
    if (!confirm(`Delete song "${song.title}"? This can be undone.`)) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.softDelete('songs', song.id);
      if (result.isSuccess()) {
        await this.loadSongs();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete song');
    } finally {
      this.isLoading.set(false);
    }
  }

  async restoreSong(song: SongWithId): Promise<void> {
    if (!confirm(`Restore song "${song.title}"?`)) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.restore('songs', song.id);
      if (result.isSuccess()) {
        await this.loadSongs();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to restore song');
    } finally {
      this.isLoading.set(false);
    }
  }

  closeForm(): void {
    this.showForm.set(false);
    this.isEditMode.set(false);
    this.editingSongId.set(null);
    this.songForm().reset();
    this.error.set(null);
  }

  getAlbumTitle(albumId?: string): string {
    if (!albumId) return 'Single';
    return this.albums().find((a) => a.id === albumId)?.title || 'Album';
  }

  clearError(): void {
    this.error.set(null);
  }

  getSongFullTitle(song: SongWithId): string {
    const title = [song.title];
    if (song.featuredArtists) {
      title.push(`(feat. ${song.featuredArtists})`);
    }

    if (song.producers) {
      title.push(`(prod. ${song.producers})`);
    }

    return title.join(' ');
  }
}

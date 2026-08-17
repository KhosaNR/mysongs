import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required, min, validate } from '@angular/forms/signals';
import { where } from '@angular/fire/firestore';
import { DbService } from '../../../core/services/db.service';
import { AuthService } from '../../../core/services/auth.service';
import { Song } from '../../../shared/models/song.interface';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';

interface LyricAnnotation {
  id: string;
  songId: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  annotationText: string;
  authorName: string;
  isActive: boolean;
  createdAt: Date;
}

interface SongWithId extends Song {
  readonly id: string;
}

/**
 * Artist lyric annotation management view.
 */
@Component({
  selector: 'app-annotation-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './annotation-management.component.html',
  styleUrl: './annotation-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);

  readonly songs = signal<SongWithId[]>([]);
  readonly annotations = signal<LyricAnnotation[]>([]);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly isEditMode = signal(false);
  readonly editingAnnotationId = signal<string | null>(null);

  readonly formData = signal({
    songId: '',
    startLine: 1,
    endLine: 1,
    startChar: 0,
    endChar: 100,
    annotationText: '',
    authorName: '',
  });

  readonly annotationForm = form(this.formData, (p) => {
    required(p.songId, { message: 'Select a song for this annotation' });
    required(p.annotationText, { message: 'Annotation text is required' });
    min(p.startLine, 1, { message: 'Start line must be at least 1' });
    min(p.endLine, 1, { message: 'End line must be at least 1' });
    min(p.startChar, 0, { message: 'Start character must be 0 or more' });
    min(p.endChar, 0, { message: 'End character must be 0 or more' });
    validate(p.endLine, (ctx) => {
      const start = ctx.valueOf(p.startLine);
      if (ctx.value() && start && ctx.value() < start) {
        return { kind: 'range', message: 'End line cannot be before the start line' };
      }
      return undefined;
    });
  });

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');

  constructor() {
    this.loadData();
  }

  async loadData(): Promise<void> {
    const id = this.artistId();
    if (!id) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const songsResult = await this.dbService.getCollection<Song>('songs', {
        constraints: [where('artistId', '==', id)],
      });
      if (songsResult.isSuccess()) {
        const songsData = songsResult
          .getData()
          .map((doc) => ({ ...doc.data, id: doc.id }) as SongWithId)
          .filter((s) => !s.isDeleted);
        this.songs.set(songsData);
      }
      await this.loadAnnotations();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadAnnotations(): Promise<void> {
    const songIds = this.songs().map((s) => s.id);
    if (songIds.length === 0) {
      this.annotations.set([]);
      return;
    }
    try {
      const result = await this.dbService.getCollection<LyricAnnotation>('lyric_annotations', {
        constraints: [where('songId', 'in', songIds)],
      });
      if (result.isSuccess()) {
        this.annotations.set(result.getData().map((doc) => ({ ...doc.data, id: doc.id })));
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load annotations');
    }
  }

  openCreateForm(): void {
    const firstSongId = this.songs()[0]?.id || '';
    this.formData.set({
      songId: firstSongId,
      startLine: 1,
      endLine: 1,
      startChar: 0,
      endChar: 100,
      annotationText: '',
      authorName: this.authService.currentUser()?.displayName || '',
    });
    this.annotationForm().reset();
    this.isEditMode.set(false);
    this.editingAnnotationId.set(null);
    this.showForm.set(true);
  }

  openEditForm(annotation: LyricAnnotation): void {
    this.formData.set({
      songId: annotation.songId,
      startLine: annotation.startLine,
      endLine: annotation.endLine,
      startChar: annotation.startChar,
      endChar: annotation.endChar,
      annotationText: annotation.annotationText,
      authorName: annotation.authorName,
    });
    this.annotationForm().reset();
    this.isEditMode.set(true);
    this.editingAnnotationId.set(annotation.id);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.isEditMode.set(false);
    this.editingAnnotationId.set(null);
  }

  getSongTitle(songId: string): string {
    return this.songs().find((s) => s.id === songId)?.title || 'Unknown Song';
  }

  async submitForm(): Promise<void> {
    this.annotationForm().markAsTouched();
    if (this.annotationForm().invalid()) {
      return;
    }

    const data = this.formData();

    this.isSubmitting.set(true);
    this.error.set(null);

    const annotationData: Partial<LyricAnnotation> = {
      songId: data.songId,
      startLine: data.startLine,
      endLine: data.endLine,
      startChar: data.startChar,
      endChar: data.endChar,
      annotationText: data.annotationText.trim(),
      authorName: data.authorName.trim(),
      isActive: true,
    };

    try {
      const result =
        this.isEditMode() && this.editingAnnotationId()
          ? await this.dbService.update(
              'lyric_annotations',
              this.editingAnnotationId()!,
              annotationData,
            )
          : await this.dbService.create('lyric_annotations', {
              ...annotationData,
              createdAt: new Date(),
            } as LyricAnnotation);
      if (result.isSuccess()) {
        this.closeForm();
        await this.loadAnnotations();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to save annotation');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async deleteAnnotation(annotation: LyricAnnotation): Promise<void> {
    if (!confirm('Delete this annotation?')) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.delete('lyric_annotations', annotation.id);
      if (result.isSuccess()) {
        await this.loadAnnotations();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete annotation');
    } finally {
      this.isLoading.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }
}

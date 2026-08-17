import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required, min } from '@angular/forms/signals';
import { DbService } from '../../../../core/services/db.service';
import { ErrorHandler } from '../../../../core/utils/error-handler';
import { FieldErrorsComponent } from '../../../../shared/components/field-errors/field-errors.component';

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

@Component({
  selector: 'app-annotations',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './annotations.component.html',
  styleUrl: './annotations.component.scss',
})
export class AnnotationsComponent {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly annotations = signal<LyricAnnotation[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly isSubmitting = signal(false);

  readonly formData = signal({
    songId: '',
    startLine: 1,
    endLine: 1,
    startChar: 0,
    endChar: 100,
    annotationText: '',
    authorName: '',
  });

  readonly annotationsForm = form(this.formData, (p) => {
    required(p.songId, { message: 'Song ID is required' });
    required(p.startLine, { message: 'Start line is required' });
    min(p.startLine, 1, { message: 'Start line must be at least 1' });
    required(p.endLine, { message: 'End line is required' });
    min(p.endLine, 1, { message: 'End line must be at least 1' });
    required(p.startChar, { message: 'Start character is required' });
    min(p.startChar, 0, { message: 'Start character must be 0 or more' });
    required(p.endChar, { message: 'End character is required' });
    min(p.endChar, 0, { message: 'End character must be 0 or more' });
    required(p.annotationText, { message: 'Annotation text is required' });
    required(p.authorName, { message: 'Author name is required' });
  });

  constructor() {
    this.loadAnnotations();
  }

  async loadAnnotations(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.getCollection<LyricAnnotation>('lyric_annotations', {
      constraints: [],
    });

    this.isLoading.set(false);

    if (result.isSuccess()) {
      const annotationsData = result.getData();
      this.annotations.set(annotationsData.map((doc) => doc.data));
    } else {
      this.error.set(result.getError());
    }
  }

  openForm(): void {
    this.annotationsForm().reset();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.formData.set({
      songId: '',
      startLine: 1,
      endLine: 1,
      startChar: 0,
      endChar: 100,
      annotationText: '',
      authorName: '',
    });
    this.annotationsForm().reset();
  }

  async submitForm(): Promise<void> {
    this.annotationsForm().markAsTouched();
    if (this.annotationsForm().invalid()) {
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
      annotationText: data.annotationText,
      authorName: data.authorName,
      isActive: true,
    };

    const result = await this.dbService.create(
      'lyric_annotations',
      annotationData as LyricAnnotation,
    );

    this.isSubmitting.set(false);

    if (result.isSuccess()) {
      this.closeForm();
      await this.loadAnnotations();
    } else {
      this.error.set(result.getError());
    }
  }

  async deleteAnnotation(annotation: LyricAnnotation): Promise<void> {
    if (!confirm(`Are you sure you want to delete this annotation?`)) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.delete('lyric_annotations', annotation.id);

    this.isLoading.set(false);

    if (result.isSuccess()) {
      await this.loadAnnotations();
    } else {
      this.error.set(result.getError());
    }
  }

  toggleAnnotation(annotation: LyricAnnotation): void {
    // Toggle annotation active status
    const newStatus = !annotation.isActive;
    this.dbService
      .update('lyric_annotations', annotation.id, { isActive: newStatus })
      .then(() => this.loadAnnotations())
      .catch(() => this.error.set('Failed to update annotation'));
  }

  clearError(): void {
    this.error.set(null);
  }
}

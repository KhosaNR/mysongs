import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Result of a successful R2 file upload.
 */
export interface UploadResult {
  readonly objectKey: string;
  readonly publicUrl: string;
}

/**
 * Service handling file uploads to Cloudflare R2 via the Worker.
 */
@Injectable({
  providedIn: 'root',
})
export class UploadService {
  readonly uploadProgress = signal<number>(0);

  /**
   * Requests an R2 upload URL from the Worker, then PUTs the file.
   *
   * @param file - The file to upload (audio or image)
   * @returns The R2 object key and public CDN URL
   * @throws Error with a descriptive message if any step fails
   */
  async uploadFile(file: File): Promise<UploadResult> {
    this.uploadProgress.set(0);
    const workerUrl = environment.api.workerUrl;

    try {
      const uploadUrlResponse = await fetch(
        `${workerUrl}/uploads?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&fileSize=${file.size}`
      );

      if (!uploadUrlResponse.ok) {
        const errBody = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error((errBody as Record<string, string>)['error'] || 'Failed to get upload URL');
      }

      const { uploadUrl } = await uploadUrlResponse.json();
      this.uploadProgress.set(30);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errBody = await uploadResponse.json().catch(() => ({}));
        throw new Error((errBody as Record<string, string>)['error'] || 'Failed to upload file');
      }

      const result = await uploadResponse.json();
      this.uploadProgress.set(100);

      return {
        objectKey: result.objectKey as string,
        publicUrl: result.publicUrl as string,
      };
    } catch (error) {
      this.uploadProgress.set(0);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Upload failed. Please try again.', { cause: error });
    }
  }

  /**
   * Reads the duration (whole seconds) of an audio file from its own metadata.
   * Uses the native HTML5 audio element — no third-party parser required.
   * Resolves 0 when the metadata cannot be read or the API is unavailable (SSR).
   *
   * @param file - The audio file to inspect
   * @returns Whole-second duration, or 0 if it cannot be determined
   */
  async readAudioDuration(file: File): Promise<number> {
    if (typeof Audio === 'undefined' || typeof URL === 'undefined') {
      return 0;
    }

    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    try {
      return await new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(0), 10_000);

        const cleanup = (): void => {
          clearTimeout(timeout);
          audio.removeEventListener('loadedmetadata', onLoaded);
          audio.removeEventListener('error', onError);
          audio.src = '';
        };

        const onLoaded = (): void => {
          cleanup();
          resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
        };

        const onError = (): void => {
          cleanup();
          resolve(0);
        };

        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('error', onError);
        audio.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
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
   * Maximum number of times a single request will wait out a Worker
   * rate-limit window before surfacing the failure.
   */
  private static readonly MAX_RATE_LIMIT_RETRIES = 3;

  /**
   * Longest single wait, mirroring the Worker's 60 s sliding window so a retry
   * cannot sleep past the window it is waiting for.
   */
  private static readonly MAX_RATE_LIMIT_WAIT_MS = 65_000;

  /**
   * True while an upload is paused waiting out a Worker rate-limit window, so
   * the UI can surface a "resuming shortly" state instead of appearing hung.
   */
  readonly isRateLimited = signal(false);

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
      const uploadUrlResponse = await this.fetchWithRateLimit(
        `${workerUrl}/uploads?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&fileSize=${file.size}`,
      );

      if (!uploadUrlResponse.ok) {
        const errBody = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error((errBody as Record<string, string>)['error'] || 'Failed to get upload URL');
      }

      const { uploadUrl } = await uploadUrlResponse.json();
      this.uploadProgress.set(30);

      const uploadResponse = await this.fetchWithRateLimit(uploadUrl, {
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
    } finally {
      this.isRateLimited.set(false);
    }
  }

  /**
   * Issues a request, transparently waiting out Worker rate limiting.
   *
   * The Worker's sliding-window limiter responds with `X-RateLimit-Reset`
   * (a Unix timestamp). The client honours it and replays the identical
   * request once the window has rolled, so a throttled upload resumes rather
   * than failing. Exhausting the retry budget returns the 429 response for the
   * caller to handle.
   *
   * @param input - Request URL
   * @param init - Optional fetch init
   * @returns The fetch response
   */
  private async fetchWithRateLimit(input: string, init?: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(input, init);

      if (response.status !== 429 || attempt >= UploadService.MAX_RATE_LIMIT_RETRIES) {
        return response;
      }

      const waitMs = this.resolveRateLimitWaitMs(response, attempt);
      this.isRateLimited.set(true);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  /**
   * Determines how long to wait before replaying a throttled request.
   *
   * Prefers the Worker's `X-RateLimit-Reset`, then `Retry-After`, and finally
   * falls back to exponential backoff with jitter.
   *
   * @param response - The 429 response
   * @param attempt - Zero-based retry attempt index
   * @returns Wait duration in milliseconds
   */
  private resolveRateLimitWaitMs(response: Response, attempt: number): number {
    const resetAt = Number(response.headers.get('X-RateLimit-Reset'));
    if (Number.isFinite(resetAt) && resetAt > 0) {
      const waitMs = resetAt * 1000 - Date.now();
      if (waitMs > 0) {
        return Math.min(waitMs, UploadService.MAX_RATE_LIMIT_WAIT_MS);
      }
    }

    const retryAfter = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, UploadService.MAX_RATE_LIMIT_WAIT_MS);
    }

    return Math.min(1_000 * 2 ** attempt, UploadService.MAX_RATE_LIMIT_WAIT_MS) + Math.floor(Math.random() * 250);
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
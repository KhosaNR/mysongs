/**
 * Upload URL generator and handler for R2 object uploads.
 *
 * Generates upload URLs for direct R2 uploads from the browser,
 * and handles the actual PUT requests to store files in R2.
 */

import { logger } from '../utils/logger';
import { corsHeaders } from '../middleware/cors';
import { validate, uploadRequestSchema } from '../utils/validation';
import type { Env } from '../index';

/**
 * Allowed content types for uploads.
 */
const AUDIO_CONTENT_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
];

const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALL_ALLOWED_CONTENT_TYPES = [...AUDIO_CONTENT_TYPES, ...IMAGE_CONTENT_TYPES];

/**
 * Maximum file size: 50MB for audio, 10MB for images.
 */
const MAX_AUDIO_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Determines the R2 bucket binding based on content type.
 */
function getBucketForContentType(env: Env, contentType: string): R2Bucket | null {
  if (AUDIO_CONTENT_TYPES.includes(contentType)) {
    return env.R2_STREAM_BUCKET;
  }
  if (IMAGE_CONTENT_TYPES.includes(contentType)) {
    return env.R2_ASSETS_BUCKET;
  }
  return null;
}

/**
 * Determines the public URL prefix based on content type.
 */
function getPublicUrlPrefix(contentType: string): string {
  if (AUDIO_CONTENT_TYPES.includes(contentType)) {
    return '/stream';
  }
  if (IMAGE_CONTENT_TYPES.includes(contentType)) {
    return '/assets';
  }
  return '';
}

/**
 * Generates an upload URL for R2 object upload.
 * The client PUTs the file directly to this URL, which the Worker proxies to R2.
 */
export async function handleUploadUrl(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    const contentType = url.searchParams.get('contentType');
    const fileSize = url.searchParams.get('fileSize');

    const requestData = { filename, contentType, fileSize };
    const validationResult = validate(uploadRequestSchema, requestData);

    if (!validationResult.success || !validationResult.data) {
      logger.warn('Upload request validation failed', {
        errors: validationResult.errors
      }, env);

      return new Response(JSON.stringify({
        error: 'Invalid request parameters',
        details: validationResult.errors
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const validatedFilename = validationResult.data!.filename as string;
    const validatedContentType = validationResult.data!.contentType as string;
    const validatedFileSize = parseInt(validationResult.data!.fileSize as string);

    if (!ALL_ALLOWED_CONTENT_TYPES.includes(validatedContentType)) {
      return new Response(JSON.stringify({
        error: 'Invalid file type. Only audio and image files are allowed.'
      }), {
        status: 415,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const isImage = IMAGE_CONTENT_TYPES.includes(validatedContentType);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE;

    if (validatedFileSize > maxSize) {
      return new Response(JSON.stringify({
        error: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = validatedFilename.split('.').pop() || 'bin';
    const objectKey = `${timestamp}_${randomId}.${extension}`;

    const origin = new URL(request.url).origin;
    const uploadUrl = `${origin}/uploads/${objectKey}`;

    const expiresInSeconds = 300;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    logger.info('Upload URL generated', {
      filename: validatedFilename,
      contentType: validatedContentType,
      objectKey,
      fileSize: validatedFileSize
    }, env);

    return new Response(JSON.stringify({
      uploadUrl,
      objectKey,
      expiresAt,
      maxFileSize: maxSize,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...corsHeaders()
      }
    });

  } catch (error) {
    logger.error('Upload URL generation failed', {
      error: error instanceof Error ? error.message : String(error)
    }, env);
    return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

/**
 * Handles PUT requests to upload files to R2.
 * Streams the request body directly to the appropriate R2 bucket.
 */
export async function handleUpload(request: Request, env: Env, path: string): Promise<Response> {
  try {
    const objectKey = path.replace('/uploads/', '');

    if (!objectKey) {
      return new Response(JSON.stringify({ error: 'Missing object key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

    if (!ALL_ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return new Response(JSON.stringify({
        error: 'Invalid file type. Only audio and image files are allowed.'
      }), {
        status: 415,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const bucket = getBucketForContentType(env, contentType);
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'No suitable bucket for this file type' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    const isImage = IMAGE_CONTENT_TYPES.includes(contentType);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE;

    if (contentLength > maxSize) {
      return new Response(JSON.stringify({
        error: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const r2Object = await bucket.put(objectKey, request.body, {
      httpMetadata: {
        contentType,
      },
    });

    // Build an absolute public URL. Prefer a configured R2 public bucket
    // domain (e.g. https://pub-xxx.r2.dev or a custom assets domain), and
    // fall back to serving the object through this Worker's own origin.
    const origin = new URL(request.url).origin;
    const publicUrl = env.R2_PUBLIC_URL
      ? `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${objectKey}`
      : `${origin}${getPublicUrlPrefix(contentType)}/${objectKey}`;

    logger.info('File uploaded to R2', {
      objectKey,
      contentType,
      size: contentLength,
      etag: r2Object.etag,
    }, env);

    return new Response(JSON.stringify({
      success: true,
      objectKey,
      publicUrl,
      etag: r2Object.etag,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });

  } catch (error) {
    logger.error('Upload to R2 failed', {
      error: error instanceof Error ? error.message : String(error),
      path,
    }, env);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

/**
 * Serves public objects (images/audio) from R2 through the Worker origin.
 *
 * Used when no dedicated R2 public bucket domain is configured, so files
 * remain reachable via the same origin that handled the upload.
 *
 * @param env - Worker environment bindings
 * @param path - The request path, e.g. `/assets/<key>` or `/stream/<key>`
 * @returns The stored object with cache headers, or 404 if missing
 */
export async function handleAssetServe(env: Env, path: string): Promise<Response> {
  try {
    const isStream = path.startsWith('/stream/');
    const objectKey = path.replace(isStream ? '/stream/' : '/assets/', '');

    if (!objectKey) {
      return new Response(JSON.stringify({ error: 'Missing object key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const bucket = isStream ? env.R2_STREAM_BUCKET : env.R2_ASSETS_BUCKET;
    const object = await bucket.get(objectKey);

    if (!object) {
      return new Response(JSON.stringify({ error: 'Object not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  } catch (error) {
    logger.error('Asset serve failed', {
      error: error instanceof Error ? error.message : String(error),
      path,
    }, env);
    return new Response(JSON.stringify({ error: 'Failed to serve asset' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

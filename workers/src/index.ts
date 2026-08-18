/**
 * Cloudflare Workers router entry point.
 *
 * Routes incoming requests to the appropriate handler:
 * - POST /webhooks/yoco — Yoco payment webhook
 * - GET /downloads/signed-url — Generate signed download URL
 * - GET /health — Health check endpoint
 *
 * All endpoints enforce CORS headers and rate limiting.
 */

import { handleYocoWebhook } from './webhooks/yoco';
import { handleSignedUrl } from './downloads/signed-url';
import { handleUploadUrl, handleUpload, handleAssetServe } from './uploads/upload-url';
import { corsForRequest, handleCorsPreflight } from './middleware/cors';
import { checkRateLimit, rateLimitHeaders } from './middleware/rate-limiter';
import { logger } from './utils/logger';

export interface Env {
  ENVIRONMENT: string;
  YOCO_WEBHOOK_SECRET: string;
  YOCO_PUBLIC_KEY: string;
  R2_STREAM_BUCKET: R2Bucket;
  R2_DOWNLOAD_BUCKET: R2Bucket;
  R2_ASSETS_BUCKET: R2Bucket;
  R2_PUBLIC_URL: string;
  RATE_LIMIT_KV: KVNamespace;
  FIRESTORE_API_URL: string;
  FIRESTORE_PROJECT_ID: string;
  FIRESTORE_PRIVATE_KEY: string;
  FIRESTORE_CLIENT_EMAIL: string;
}

/**
 * Main request handler.
 * Routes requests based on URL path and method.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleCorsPreflight(request);
    }

    // Extract client IP or user ID for rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitIdentifier = `worker:${clientIp}`;

    // Health checks are exempt from rate limiting so monitoring is never throttled.
    if (path === '/health' && method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsForRequest(request),
        },
      });
    }

    try {
      // Apply rate limiting to all endpoints (30 req/min per IP)
      const rateLimitResult = await checkRateLimit(rateLimitIdentifier, env, 30, 60);
      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded', { identifier: rateLimitIdentifier }, env);
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...corsForRequest(request),
            ...rateLimitHeaders(rateLimitResult, 30),
          },
        });
      }

      // Route to appropriate handler
      switch (true) {
        // Yoco webhook endpoint
        case path === '/webhooks/yoco' && method === 'POST':
          return await handleYocoWebhook(request, env);

        // Signed download URL endpoint
        case path === '/downloads/signed-url' && method === 'GET':
          return await handleSignedUrl(request, env);

        // Upload URL endpoint
        case path === '/uploads' && method === 'GET':
          return await handleUploadUrl(request, env);

        // Upload file to R2
        case path.startsWith('/uploads/') && method === 'PUT':
          return await handleUpload(request, env, path);

        // Serve public assets/images from R2 through the Worker origin.
        // Used as a fallback when no dedicated R2 public bucket domain
        // is configured (R2_PUBLIC_URL is empty).
        case (path.startsWith('/assets/') || path.startsWith('/stream/')) && method === 'GET':
          return await handleAssetServe(request, env, path);

        // 404 for unknown routes
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsForRequest(request),
            },
          });
      }
    } catch (error) {
      logger.error('Unhandled worker error', {
        error: error instanceof Error ? error.message : String(error),
        path,
        method,
      }, env);

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsForRequest(request),
        },
      });
    }
  },
};
/**
 * Signed URL generator for secure download links
 * 
 * Generates time-limited signed URLs for R2 object downloads.
 */

import { logger } from '../utils/logger';
import { corsHeaders } from '../middleware/cors';
import { validate, downloadRequestSchema } from '../utils/validation';

export interface Env {
  ENVIRONMENT: string;
  R2_BUCKET: R2Bucket;
}

export async function handleSignedUrl(request: Request, env: Env): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const songId = url.searchParams.get('songId');
    const userId = url.searchParams.get('userId');

    // Validate required parameters
    const requestData = { songId, userId };
    const validationResult = validate(downloadRequestSchema, requestData);
    
    if (!validationResult.success || !validationResult.data) {
      logger.warn('Download request validation failed', { 
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

    const validatedSongId = validationResult.data.songId as string;
    const validatedUserId = userId!; // userId is required but not in schema

    // Verify user has purchased this song
    const hasPurchased = await verifyPurchase(validatedUserId, validatedSongId, env);
    if (!hasPurchased) {
      logger.warn('Unauthorized download attempt', { userId, songId }, env);
      return new Response(JSON.stringify({ error: 'Song not purchased' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Generate signed URL for R2 object
    const objectKey = `secure_audio/${validatedSongId}_320.mp3`;
    
    // Get R2 object metadata
    const object = await env.R2_BUCKET.head(objectKey);
    if (!object) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Generate presigned URL (5-minute expiry)
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    const signedUrl = generatePresignedUrl(objectKey, expiresAt, env);

    logger.info('Signed URL generated', { songId: validatedSongId, userId: validatedUserId }, env);

    return new Response(JSON.stringify({
      url: signedUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      cacheControl: 'private, max-age=300'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...corsHeaders()
      }
    });

  } catch (error) {
    logger.error('Signed URL generation failed', { 
      error: error instanceof Error ? error.message : String(error) 
    }, env);
    return new Response(JSON.stringify({ error: 'Failed to generate download URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

/**
 * Verifies user has purchased the song
 */
async function verifyPurchase(userId: string, songId: string, env: Env): Promise<boolean> {
  try {
    // TODO: Implement Firestore query to check purchases_ledger
    // For now, return true for development
    // In production, query: env.FIRESTORE_DB.collection('purchases_ledger')
    //   .where('userId', '==', userId)
    //   .where('songId', '==', songId)
    //   .limit(1)
    //   .get()
    
    return true;
  } catch (error) {
    logger.error('Purchase verification failed', { userId, songId, error: String(error) }, env);
    return false;
  }
}

/**
 * Generates a presigned URL for R2 object access
 */
function generatePresignedUrl(objectKey: string, expiresAt: number, env: Env): string {
  const baseUrl = env.ENVIRONMENT === 'production' 
    ? 'https://cdn.leobee.com'
    : 'http://localhost:8787';
  
  // In production, use proper R2 presigned URL generation
  return `${baseUrl}/${objectKey}?expires=${expiresAt}&signature=placeholder`;
}
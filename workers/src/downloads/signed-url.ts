/**
 * Signed URL generator for secure download links
 * 
 * Generates time-limited signed URLs for R2 object downloads.
 * Verifies user authentication and purchase authorization before issuing download URLs.
 * The `userId` query parameter is the public application user ID (the `users/{userId}`
 * key), not the Firebase Auth UID.
 */

import { logger } from '../utils/logger';
import { corsHeaders } from '../middleware/cors';
import { validate, downloadRequestSchema } from '../utils/validation';
import type { Env } from '../index';

/**
 * Gets a Firestore access token using service account credentials.
 * Reuses the same function from the webhook handler for consistency.
 */
async function getFirestoreAccessToken(env: Env): Promise<string> {
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: env.FIRESTORE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodeBase64 = (obj: Record<string, unknown>): string => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerEncoded = encodeBase64(jwtHeader);
  const payloadEncoded = encodeBase64(jwtPayload);
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const privateKey = env.FIRESTORE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const encoder = new TextEncoder();
  
  const pemHeader = '-----BEGIN PRIVATE KEY-----\n';
  const pemFooter = '\n-----END PRIVATE KEY-----';
  const pemContents = privateKey.includes(pemHeader) 
    ? privateKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\n/g, '')
    : privateKey;
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureArray = Array.from(new Uint8Array(signature));
  let signatureBinary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    signatureBinary += String.fromCharCode(signatureArray[i]);
  }
  const signatureEncoded = btoa(signatureBinary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signingInput}.${signatureEncoded}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get Firestore access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json() as { access_token: string };
  return tokenData.access_token;
}

/**
 * Verifies user has purchased the song by querying the Firestore purchases_ledger.
 * Checks for:
 * 1. A single purchase record for the specific songId
 * 2. An album purchase that includes the songId in its songIds array
 *
 * @param userId - Public application user ID (matches `purchases_ledger.userId`)
 * @param songId - The song ID to verify
 * @param env - Worker environment bindings
 */
async function verifyPurchase(userId: string, songId: string, env: Env): Promise<boolean> {
  try {
    // Check for direct single purchase
    const singlePurchaseUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/purchases_ledger?filter=userId=%22${userId}%22%20AND%20songId=%22${songId}%22%20AND%20status=%22completed%22`;
    
    const token = await getFirestoreAccessToken(env);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const singleResponse = await fetch(singlePurchaseUrl, { headers });
    if (singleResponse.ok) {
      const singleData = await singleResponse.json() as { documents?: unknown[] };
      if (singleData.documents && singleData.documents.length > 0) {
        logger.info('Purchase verified: single song purchase', { userId, songId }, env);
        return true;
      }
    }

    // Check for album purchases that include this song
    // Firestore doesn't support array-contains via REST API easily,
    // so we query for album purchases by this user and check the songIds array
    const albumPurchasesUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/purchases_ledger?filter=userId=%22${userId}%22%20AND%20purchaseType=%22album%22%20AND%20status=%22completed%22`;
    
    const albumResponse = await fetch(albumPurchasesUrl, { headers });
    if (albumResponse.ok) {
      const albumData = await albumResponse.json() as { documents?: Array<{ fields?: Record<string, unknown> }> };
      if (albumData.documents) {
        for (const doc of albumData.documents) {
          if (doc.fields) {
            const fields = doc.fields as Record<string, { arrayValue?: { values?: Array<{ stringValue?: string }> } }>;
            const songIdsField = fields.songIds;
            if (songIdsField?.arrayValue?.values) {
              const songIds = songIdsField.arrayValue.values.map(
                (v: { stringValue?: string }) => v.stringValue || ''
              );
              if (songIds.includes(songId)) {
                logger.info('Purchase verified: album purchase includes song', { 
                  userId, songId 
                }, env);
                return true;
              }
            }
          }
        }
      }
    }

    logger.warn('Purchase not found for download', { userId, songId }, env);
    return false;
  } catch (error) {
    logger.error('Purchase verification failed', { 
      userId, 
      songId, 
      error: String(error) 
    }, env);
    return false;
  }
}

/**
 * Extended R2Bucket interface that includes the createSignedUrl method.
 * Available at runtime in Cloudflare Workers but missing from type definitions.
 */
interface R2BucketWithSignedUrl extends R2Bucket {
  createSignedUrl(
    method: 'get' | 'put' | 'delete',
    key: string,
    options: { signedExpiry: number }
  ): Promise<string>;
}

async function generateR2SignedUrl(
  bucket: R2Bucket,
  objectKey: string,
  expiresInSeconds: number
): Promise<string | null> {
  try {
    // Check if the object exists
    const object = await bucket.head(objectKey);
    if (!object) {
      logger.error('R2 object not found', { objectKey });
      return null;
    }

    // Generate a signed URL using the R2 bucket's built-in support
    // Cast to extended interface — createSignedUrl is available at runtime
    const bucketWithSignedUrl = bucket as R2BucketWithSignedUrl;
    const signedUrl = await bucketWithSignedUrl.createSignedUrl('get', objectKey, {
      signedExpiry: expiresInSeconds,
    });

    return signedUrl;
  } catch (error) {
    logger.error('Failed to generate R2 signed URL', {
      objectKey,
      error: String(error),
    });
    return null;
  }
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
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Verify user has purchased this song
    const hasPurchased = await verifyPurchase(userId, validatedSongId, env);
    if (!hasPurchased) {
      logger.warn('Unauthorized download attempt', { userId, songId: validatedSongId }, env);
      return new Response(JSON.stringify({ error: 'Song not purchased' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Generate signed URL for R2 object
    const objectKey = `secure_audio/${validatedSongId}_320.mp3`;
    const expiresInSeconds = 300; // 5 minutes
    
    const signedUrl = await generateR2SignedUrl(env.R2_DOWNLOAD_BUCKET, objectKey, expiresInSeconds);
    if (!signedUrl) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    logger.info('Signed URL generated', { 
      songId: validatedSongId, 
      userId 
    }, env);

    return new Response(JSON.stringify({
      url: signedUrl,
      expiresAt,
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
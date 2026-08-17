/**
 * Yoco webhook handler
 * 
 * Handles payment confirmation webhooks from Yoco payment gateway.
 * Implements cryptographic signature verification and idempotency checks
 * against the Firestore purchases_ledger collection.
 */

import { logger } from '../utils/logger';
import { corsHeaders } from '../middleware/cors';
import { validate, yocoWebhookSchema } from '../utils/validation';
import type { Env } from '../index';

/**
 * Verifies Yoco webhook signature using HMAC-SHA256.
 * Yoco signs webhook payloads with a shared secret using HMAC-SHA256.
 * The signature is sent in the `X-Yoco-Signature` header as a hex string.
 */
async function verifyYocoSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = signatureArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  } catch (error) {
    logger.error('Signature verification failed', { error: String(error) });
    return false;
  }
}

/**
 * Checks if a payment event has already been processed (idempotency gate).
 * Queries the Firestore purchases_ledger collection for the event ID.
 * Returns true if the event has already been processed.
 */
async function checkIdempotency(eventId: string, env: Env): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/purchases_ledger?filter=id=%22${eventId}%22`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${await getFirestoreAccessToken(env)}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn('Idempotency check request failed', { 
        status: response.status, 
        eventId 
      }, env);
      return false;
    }

    const data = await response.json() as { documents?: unknown[] };
    return data.documents !== undefined && data.documents.length > 0;
  } catch (error) {
    logger.error('Idempotency check failed', { 
      eventId, 
      error: String(error) 
    }, env);
    // Fail open — allow processing if check fails
    return false;
  }
}

/**
 * Writes a purchase record to the Firestore purchases_ledger collection.
 */
async function writePurchaseToLedger(
  purchaseData: Record<string, unknown>,
  env: Env
): Promise<boolean> {
  try {
    const docId = purchaseData.id as string;
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/purchases_ledger?documentId=${docId}`;

    // Convert to Firestore document format
    const document = {
      fields: {
        id: { stringValue: purchaseData.id },
        userId: { stringValue: purchaseData.userId as string },
        artistId: { stringValue: purchaseData.artistId as string },
        purchaseType: { stringValue: purchaseData.purchaseType as string },
        songId: purchaseData.songId ? { stringValue: purchaseData.songId as string } : null,
        albumId: purchaseData.albumId ? { stringValue: purchaseData.albumId as string } : null,
        songIds: Array.isArray(purchaseData.songIds)
          ? {
              arrayValue: {
                values: (purchaseData.songIds as string[]).map((id) => ({ stringValue: id })),
              },
            }
          : null,
        amountZAR: { doubleValue: purchaseData.amountZAR as number },
        currency: { stringValue: (purchaseData.currency as string) || 'ZAR' },
        gatewayReference: { stringValue: purchaseData.gatewayReference as string },
        status: { stringValue: purchaseData.status as string },
        timestamp: { timestampValue: new Date().toISOString() },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    };

    // Remove null fields
    const cleanFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(document.fields)) {
      if (value !== null) {
        cleanFields[key] = value;
      }
    }
    document.fields = cleanFields as typeof document.fields;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getFirestoreAccessToken(env)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Failed to write purchase to ledger', {
        status: response.status,
        errorBody,
        purchaseId: purchaseData.id,
      }, env);
      return false;
    }

    logger.info('Purchase written to ledger', { 
      purchaseId: purchaseData.id,
      userId: purchaseData.userId,
    }, env);

    return true;
  } catch (error) {
    logger.error('Failed to write purchase to ledger', {
      error: String(error),
      purchaseId: purchaseData.id,
    }, env);
    return false;
  }
}

/**
 * Fetches the non-deleted song IDs belonging to an album. Used to snapshot
 * `songIds` on an album purchase ledger record so every track in the album can
 * later be authorized for download.
 */
async function getAlbumSongIds(albumId: string, env: Env): Promise<string[]> {
  try {
    const encodedFilter = `albumId%3D%22${encodeURIComponent(albumId)}%22%20AND%20isDeleted%3Dfalse`;
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/songs?filter=${encodedFilter}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${await getFirestoreAccessToken(env)}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn('Album song fetch failed', {
        status: response.status,
        albumId,
      }, env);
      return [];
    }

    const data = await response.json() as {
      documents?: { fields?: Record<string, { stringValue?: string }> }[];
    };

    return (data.documents || [])
      .map((doc) => doc.fields?.songId?.stringValue || '')
      .filter(Boolean);
  } catch (error) {
    logger.error('Failed to fetch album song IDs', {
      albumId,
      error: String(error),
    }, env);
    return [];
  }
}

/**
 * Gets a Firestore access token using service account credentials.
 * Uses the Firebase Admin SDK service account private key.
 */
async function getFirestoreAccessToken(env: Env): Promise<string> {
  // For simplicity in development, use the private key directly
  // In production, this would use OAuth2 token exchange
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: env.FIRESTORE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Encode JWT parts
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

  // Sign with private key
  const privateKey = env.FIRESTORE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const encoder = new TextEncoder();
  const keyData = encoder.encode(privateKey);
  
  // Import the private key
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

  // Exchange JWT for access token
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

export async function handleYocoWebhook(request: Request, env: Env): Promise<Response> {
  logger.info('Yoco webhook received', undefined, env);

  try {
    // Get raw request body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature
    const signature = request.headers.get('X-Yoco-Signature');
    if (!signature) {
      logger.warn('Webhook missing signature header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const isValid = await verifyYocoSignature(rawBody, signature, env.YOCO_WEBHOOK_SECRET);
    if (!isValid) {
      logger.warn('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Parse webhook payload
    const payload = JSON.parse(rawBody);

    // Validate payload against schema
    const validationResult = validate(yocoWebhookSchema, payload);
    
    if (!validationResult.success || !validationResult.data) {
      logger.warn('Webhook validation failed', { 
        errors: validationResult.errors 
      }, env);
      
      return new Response(JSON.stringify({ 
        error: 'Validation failed',
        details: validationResult.errors 
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const validatedPayload = validationResult.data as {
      id: string;
      type: string;
      data: { 
        id: string;
        amount: number;
        currency: string;
        status: string;
        metadata?: { 
          userId?: string; 
          songId?: string;
          albumId?: string;
          artistId?: string;
          purchaseType?: string;
        };
      };
    };
    
    logger.info('Yoco webhook payload validated', { 
      eventId: validatedPayload.id, 
      eventType: validatedPayload.type,
      paymentId: validatedPayload.data.id,
      amount: validatedPayload.data.amount,
      currency: validatedPayload.data.currency,
      status: validatedPayload.data.status,
    }, env);

    // Idempotency check: has this payment event already been processed?
    const alreadyProcessed = await checkIdempotency(validatedPayload.data.id, env);
    if (alreadyProcessed) {
      logger.info('Duplicate webhook received, acknowledging', { 
        paymentId: validatedPayload.data.id 
      }, env);
      return new Response(JSON.stringify({ 
        received: true, 
        duplicate: true,
        paymentId: validatedPayload.data.id 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Only process completed payments
    if (validatedPayload.data.status !== 'successful' && validatedPayload.data.status !== 'completed') {
      logger.info('Payment not completed, skipping', { 
        paymentId: validatedPayload.data.id,
        status: validatedPayload.data.status 
      }, env);
      return new Response(JSON.stringify({ 
        received: true, 
        processed: false,
        reason: 'Payment not completed',
        paymentId: validatedPayload.data.id 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Extract metadata for purchase record
    const metadata = validatedPayload.data.metadata || {};
    const userId = metadata.userId || 'unknown';
    const songId = metadata.songId;
    const albumId = metadata.albumId;
    const artistId = metadata.artistId || 'unknown';
    const purchaseType = metadata.purchaseType || 'single';

    // Build purchase record
    const purchaseRecord: Record<string, unknown> = {
      id: validatedPayload.data.id,
      userId,
      artistId,
      purchaseType,
      amountZAR: validatedPayload.data.amount / 100, // Convert cents to ZAR
      currency: validatedPayload.data.currency || 'ZAR',
      gatewayReference: validatedPayload.data.id,
      status: 'completed',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Add songId for single purchases
    if (purchaseType === 'single' && songId) {
      purchaseRecord.songId = songId;
    }

    // Add albumId + songIds snapshot for album purchases so every track in the
    // album can be authorized for download later.
    if (purchaseType === 'album' && albumId) {
      purchaseRecord.albumId = albumId;
      purchaseRecord.songIds = await getAlbumSongIds(albumId, env);
    }

    // Write purchase to Firestore ledger
    const writeSuccess = await writePurchaseToLedger(purchaseRecord, env);
    if (!writeSuccess) {
      logger.error('Failed to persist purchase to ledger', { 
        paymentId: validatedPayload.data.id 
      }, env);
      // Return 200 to acknowledge receipt, but indicate processing failure
      // Yoco will retry the webhook
      return new Response(JSON.stringify({ 
        received: true, 
        processed: false,
        error: 'Failed to persist purchase',
        paymentId: validatedPayload.data.id 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    logger.info('Purchase processed successfully', { 
      paymentId: validatedPayload.data.id,
      userId,
      songId,
      amountZAR: validatedPayload.data.amount / 100,
    }, env);

    return new Response(JSON.stringify({ 
      received: true, 
      processed: true,
      paymentId: validatedPayload.data.id 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });

  } catch (error) {
    logger.error('Yoco webhook processing failed', { 
      error: error instanceof Error ? error.message : String(error) 
    }, env);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }
}
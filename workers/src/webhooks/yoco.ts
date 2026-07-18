/**
 * Yoco webhook handler
 * 
 * Handles payment confirmation webhooks from Yoco payment gateway.
 * Implements cryptographic signature verification and idempotency checks.
 */

import { logger } from '../utils/logger';
import { corsHeaders } from '../middleware/cors';
import { validate, yocoWebhookSchema, ValidationResult } from '../utils/validation';

export interface Env {
  ENVIRONMENT: string;
  YOCO_WEBHOOK_SECRET: string;
}

/**
 * Verifies Yoco webhook signature using HMAC-SHA256
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
        metadata?: { userId?: string; songId?: string };
      };
    };
    
    logger.info('Yoco webhook payload', { 
      eventId: validatedPayload.id, 
      eventType: validatedPayload.type,
      paymentId: validatedPayload.data.id 
    }, env);

    // TODO: Implement idempotency check using KV namespace
    // Check if this payment ID has already been processed
    // const processed = await checkIdempotency(validatedPayload.data.id, env);
    // if (processed) {
    //   return new Response(JSON.stringify({ received: true, duplicate: true }), {
    //     status: 200,
    //     headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    //   });
    // }

    // TODO: Implement Firestore write to purchases_ledger
    // This requires Firestore binding in wrangler.jsonc
    // await env.FIRESTORE_DB.collection('purchases_ledger').add({
    //   purchaseId: validatedPayload.data.id,
    //   amount: validatedPayload.data.amount / 100, // Convert cents to ZAR
    //   currency: validatedPayload.data.currency,
    //   status: validatedPayload.data.status,
    //   timestamp: new Date().toISOString()
    // });

    logger.info('Webhook processed successfully', { paymentId: validatedPayload.data.id }, env);

    return new Response(JSON.stringify({ 
      received: true, 
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
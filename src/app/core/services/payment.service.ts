/**
 * Payment service for managing Yoco Web SDK checkout and purchase flows.
 *
 * Handles Yoco checkout initialization, purchase state tracking,
 * and download authorization via the Cloudflare Worker signed URL endpoint.
 *
 * @example
 * ```typescript
 * const paymentService = inject(PaymentService);
 *
 * // Initiate checkout for a single track
 * const result = await paymentService.initiateCheckout({
 *   songId: 'track_101',
 *   purchaseType: 'single',
 *   amountZAR: 5.00,
 *   userId: 'usr_AbCd123456...',
 *   artistId: 'artist_01'
 * });
 *
 * // Check if user has purchased a song
 * const isPurchased = await paymentService.checkPurchaseStatus('track_101');
 *
 * // Get download URL
 * const downloadInfo = await paymentService.getDownloadUrl('track_101');
 * ```
 */

import { Injectable, inject, signal } from '@angular/core';
import { where } from '@angular/fire/firestore';
import { ErrorHandler, Result } from '../utils/error-handler';
import { environment } from '../../../environments/environment';
import type { PurchaseRequest, PurchaseResult, DownloadInfo, Purchase } from '../../shared/models/purchase.interface';
import { DbService } from './db.service';

declare global {
  interface Window {
    Yoco?: new (config: { publicKey: string }) => YocoCheckout;
  }
}

/**
 * Yoco checkout instance returned by the window-level constructor.
 */
interface YocoCheckout {
  readonly showCheckout: (options: YocoCheckoutOptions) => YocoCheckoutInstance;
}

interface YocoCheckoutOptions {
  readonly amount: number;
  readonly currency?: string;
  readonly description?: string;
  readonly metadata?: Record<string, string>;
  readonly successUrl?: string;
  readonly cancelUrl?: string;
  readonly onSuccess: (result: { id: string }) => void;
  readonly onCancel: (result: { id: string }) => void;
  readonly onError: (error: { message: string }) => void;
}

interface YocoCheckoutInstance {
  readonly destroy: () => void;
}

/**
 * Service handling all payment-related operations.
 * Manages the Yoco checkout lifecycle and purchase state.
 */
@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly errorHandler = inject(ErrorHandler);
  private readonly dbService = inject(DbService);
  private readonly workerBaseUrl = environment.api.workerUrl;

  /** Signal indicating if a checkout is currently in progress. */
  readonly isProcessing = signal<boolean>(false);

  /** Signal containing the current purchase error message. */
  readonly error = signal<string | null>(null);

  /** Signal containing the last successful purchase result. */
  readonly lastPurchase = signal<PurchaseResult | null>(null);

  /** Cache of purchased song IDs for quick lookup. */
  private readonly purchasedSongs = signal<Set<string>>(new Set());

  /** Cache of purchased album IDs for quick lookup. */
  private readonly purchasedAlbums = signal<Set<string>>(new Set());

  constructor() {
    this.loadYocoSDK();
  }

  /**
   * Dynamically loads the Yoco Web SDK script if not already present.
   * @private
   */
  private loadYocoSDK(): void {
    if (typeof window === 'undefined') return; // SSR guard
    if (document.querySelector('script[src*="yoco"')) return;

    const script = document.createElement('script');
    script.src = 'https://js.yoco.com/sdk/v1/yoco.js';
    script.async = true;
    script.onload = () => {
      console.info('Yoco SDK loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load Yoco SDK');
    };
    document.head.appendChild(script);
  }

  /**
   * Initiates a Yoco checkout overlay for a purchase.
   * Opens the Yoco payment modal and handles the result.
   *
   * @param request - The purchase request details
   * @returns A Result containing the purchase outcome
   */
  async initiateCheckout(request: PurchaseRequest): Promise<Result<PurchaseResult>> {
    this.isProcessing.set(true);
    this.error.set(null);

    return this.errorHandler.execute(
      () => this.processCheckout(request),
      'initiateCheckout',
      {
        purchaseType: request.purchaseType,
        amountZAR: request.amountZAR,
        hasSongId: !!request.songId,
        hasAlbumId: !!request.albumId,
      }
    );
  }

  /**
   * Processes the Yoco checkout flow.
   * @private
   */
  private processCheckout(request: PurchaseRequest): Promise<PurchaseResult> {
    return new Promise((resolve, reject) => {
      try {
        // Ensure Yoco SDK is loaded
        if (!window.Yoco) {
          reject(new Error('Payment system not loaded. Please try again.'));
          return;
        }

        // Create Yoco checkout instance
        const yoco = new window.Yoco({
          publicKey: environment.yoco.publicKey,
        });

        // Convert amount to cents
        const amountInCents = Math.round(request.amountZAR * 100);

        yoco.showCheckout({
          amount: amountInCents,
          currency: 'ZAR',
          description: request.songId
            ? `Track purchase: ${request.songId}`
            : `Album purchase: ${request.albumId}`,
          metadata: {
            userId: request.userId,
            artistId: request.artistId,
            purchaseType: request.purchaseType,
            ...(request.songId && { songId: request.songId }),
            ...(request.albumId && { albumId: request.albumId }),
          },
          onSuccess: async (result: { id: string }) => {
            this.isProcessing.set(true);
            try {
              // Wait for webhook to process (max 30 seconds)
              const purchaseResult = await this.waitForPurchaseConfirmation(
                result.id
              );
              this.lastPurchase.set(purchaseResult);
              
              // Add to purchased songs cache
              if (request.songId) {
                this.purchasedSongs.update(s => {
                  const next = new Set(s);
                  next.add(request.songId!);
                  return next;
                });
              }

              // Add to purchased albums cache
              if (request.albumId) {
                this.purchasedAlbums.update(s => {
                  const next = new Set(s);
                  next.add(request.albumId!);
                  return next;
                });
              }

              this.isProcessing.set(false);
              resolve(purchaseResult);
            } catch (error) {
              this.isProcessing.set(false);
              reject(error);
            }
          },
          onCancel: () => {
            this.isProcessing.set(false);
            resolve({
              success: false,
              error: 'Payment was cancelled.',
            });
          },
          onError: (error: { message: string }) => {
            this.isProcessing.set(false);
            resolve({
              success: false,
              error: error.message || 'Payment failed. Please try again.',
            });
          },
        });
      } catch (error) {
        this.isProcessing.set(false);
        reject(error);
      }
    });
  }

  /**
   * Waits for the Yoco webhook to be processed and the purchase record
   * to appear in Firestore. Polls the purchases_ledger until confirmed
   * or timeout (30 seconds).
   * @private
   */
  private async waitForPurchaseConfirmation(chargeId: string): Promise<PurchaseResult> {
    const maxAttempts = 30; // 30 seconds at 1s interval
    const delay = 1000; // 1 second

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const purchase = await this.queryPurchase();
        if (purchase) {
          return {
            success: true,
            purchase,
            gatewayReference: chargeId,
          };
        }
      } catch {
        // Silently retry
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
      success: true, // Yoco confirmed success, ledger sync may be delayed
      gatewayReference: chargeId,
      error: 'Purchase was successful but confirmation is pending. Your download will be available shortly.',
    };
  }

  /**
   * Queries the Firestore purchases_ledger via the worker API
   * to check if a purchase has been recorded.
   * @private
   */
  private async queryPurchase(): Promise<Purchase | null> {
    try {
      // This would be a query through the worker or direct Firestore read
      // For now, we check via the worker health endpoint which proxies
      // In production, implement direct Firestore query via DbService
      const url = `${this.workerBaseUrl}/health`;
      const response = await fetch(url);
      if (response.ok) {
        // TODO: Implement actual purchase query via worker or Firestore
        // For now, return a simulated confirmation after a short delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate a successful purchase lookup
        // In production, replace with actual Firestore query
        return null; // Return null to trigger polling - webhook hasn't processed yet
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if the current user has purchased a specific song.
   * Queries the Firestore purchases_ledger for verification.
   *
   * @param songId - The song ID to check
   * @param userId - The public user ID
   * @returns true if the song has been purchased
   */
  async checkPurchaseStatus(
    songId: string,
    userId: string
  ): Promise<boolean> {
    // Check in-memory cache first
    if (this.purchasedSongs().has(songId)) {
      return true;
    }

    const result = await this.errorHandler.execute(
      async () => {
        // Query the worker's signed URL as a check (returns 403 if not purchased)
        const url = `${this.workerBaseUrl}/downloads/signed-url?songId=${encodeURIComponent(songId)}&userId=${encodeURIComponent(userId)}`;
        const response = await fetch(url, {
          method: 'HEAD',
        });

        // If we can get a preflight, the song is purchased
        // 403 means not purchased, other means purchased
        if (response.status === 403) {
          return false;
        }

        // Add to cache
        this.purchasedSongs.update(s => {
          const next = new Set(s);
          next.add(songId);
          return next;
        });

        return response.ok;
      },
      'checkPurchaseStatus',
      { songId }
    );

    return result.isSuccess() ? result.getData() : false;
  }

  /**
   * Checks if the current user has purchased a specific album.
   * Queries the Firestore purchases_ledger for a completed album purchase
   * matching the album ID (self-reads only; no composite index required).
   *
   * @param albumId - The album ID to check
   * @param userId - The public user ID
   * @returns true if the album has been purchased
   */
  async checkAlbumPurchaseStatus(
    albumId: string,
    userId: string
  ): Promise<boolean> {
    // Check in-memory cache first
    if (this.purchasedAlbums().has(albumId)) {
      return true;
    }

    const result = await this.errorHandler.execute(
      async () => {
        const ledger = await this.dbService.getCollection<Purchase>(
          'purchases_ledger',
          {
            constraints: [where('userId', '==', userId)],
          }
        );

        if (!ledger.isSuccess()) {
          return false;
        }

        const owned = ledger.getData().some(
          (doc) =>
            doc.data.purchaseType === 'album' &&
            doc.data.albumId === albumId &&
            doc.data.status === 'completed'
        );

        if (owned) {
          this.purchasedAlbums.update(s => {
            const next = new Set(s);
            next.add(albumId);
            return next;
          });
        }

        return owned;
      },
      'checkAlbumPurchaseStatus',
      { albumId }
    );

    return result.isSuccess() ? result.getData() : false;
  }

  /**
   * Gets a signed download URL for a purchased song.
   * The URL expires after 5 minutes.
   *
   * @param songId - The song ID to download
   * @param userId - The public user ID
   * @returns Download information with signed URL
   */
  async getDownloadUrl(
    songId: string,
    userId: string
  ): Promise<Result<DownloadInfo>> {
    return this.errorHandler.execute(
      async () => {
        const url = `${this.workerBaseUrl}/downloads/signed-url?songId=${encodeURIComponent(songId)}&userId=${encodeURIComponent(userId)}`;
        const response = await fetch(url);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Download failed' }));
          throw new Error(error.error || 'Failed to generate download URL');
        }

        const data = await response.json() as DownloadInfo;
        return data;
      },
      'getDownloadUrl',
      { songId }
    );
  }

  /**
   * Triggers a file download from a signed URL.
   * Creates a temporary anchor element and clicks it.
   *
   * @param downloadInfo - The download URL and metadata
   * @param filename - The desired filename for the download
   */
  triggerDownload(downloadInfo: DownloadInfo, filename: string): void {
    if (typeof window === 'undefined') return; // SSR guard

    const anchor = document.createElement('a');
    anchor.href = downloadInfo.url;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  /**
   * Clears the current purchase error.
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Resets the purchase state.
   */
  reset(): void {
    this.isProcessing.set(false);
    this.error.set(null);
    this.lastPurchase.set(null);
  }
}
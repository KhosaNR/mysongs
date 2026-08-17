/**
 * Represents a purchase/transaction record in the My Songs platform.
 *
 * Maps to the `purchases_ledger` Firestore collection (read-only).
 *
 * Supports polymorphic purchase types:
 * - `single`: A single track purchase, references a `songId`.
 * - `album`: An entire album purchase, references an `albumId` and includes a `songIds` snapshot.
 *
 * @interface Purchase
 * @example
 * ```typescript
 * // Single track purchase
 * const single: Purchase = {
 *   id: 'yoco_event_998811',
 *   userId: 'usr_AbCd123456...',
 *   artistId: 'artist_01',
 *   purchaseType: 'single',
 *   songId: 'track_101',
 *   amountZAR: 5.00,
 *   timestamp: new Date('2026-07-02T11:00:00Z'),
 *   gatewayReference: 'ch_99211AAsd',
 *   status: 'completed'
 * };
 *
 * // Album purchase
 * const album: Purchase = {
 *   id: 'yoco_event_998812',
 *   userId: 'usr_AbCd123456...',
 *   artistId: 'artist_01',
 *   purchaseType: 'album',
 *   albumId: 'album_01',
 *   songIds: ['track_101', 'track_102', 'track_103'],
 *   amountZAR: 15.00,
 *   timestamp: new Date('2026-07-02T12:00:00Z'),
 *   gatewayReference: 'ch_99211BBsd',
 *   status: 'completed'
 * };
 * ```
 */

export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'failed';
export type PurchaseType = 'single' | 'album';

/**
 * Represents a purchase record in the purchases_ledger Firestore collection.
 */
export interface Purchase {
  /**
   * Unique identifier for the purchase record (Yoco event/charge ID).
   * @format uuid
   */
  readonly id: string;

  /**
   * Reference to the public user who made the purchase (the `users/{userId}` key).
   * @format slug
   */
  readonly userId: string;

  /**
   * Reference to the artist whose content was purchased.
   * @format uuid
   */
  readonly artistId: string;

  /**
   * Type of purchase: 'single' for one track, 'album' for an entire album.
   */
  readonly purchaseType: PurchaseType;

  /**
   * Reference to the purchased song (only for single purchases).
   * @format uuid
   */
  readonly songId?: string;

  /**
   * Reference to the purchased album (only for album purchases).
   * @format uuid
   */
  readonly albumId?: string;

  /**
   * Snapshot of song IDs included in the album at time of purchase.
   * Only present for album purchases. Allows download authorization for each track.
   * @maxItems 50
   */
  readonly songIds?: string[];

  /**
   * Amount charged in South African Rand.
   * @minimum 0
   * @maximum 1000
   */
  readonly amountZAR: number;

  /**
   * Currency code for the transaction.
   * @default 'ZAR'
   */
  readonly currency?: string;

  /**
   * Timestamp when the purchase was processed.
   * @format date-time
   */
  readonly timestamp: Date;

  /**
   * Payment gateway transaction reference (Yoco charge ID).
   * @maxLength 200
   */
  readonly gatewayReference: string;

  /**
   * Current status of the purchase transaction.
   * @default 'pending'
   */
  readonly status: PurchaseStatus;

  /**
   * Timestamp when the record was created in Firestore.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the record was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;
}

/**
 * Represents a purchase request sent from the Angular app to the Yoco checkout flow.
 * Not stored in Firestore — used only for checkout initiation.
 */
export interface PurchaseRequest {
  /**
   * The song ID to purchase (for single purchases).
   * @format uuid
   */
  readonly songId?: string;

  /**
   * The album ID to purchase (for album purchases).
   * @format uuid
   */
  readonly albumId?: string;

  /**
   * Type of purchase.
   */
  readonly purchaseType: PurchaseType;

  /**
   * Price in ZAR.
   * @minimum 0
   */
  readonly amountZAR: number;

  /**
   * Public user ID for receipt metadata (the `users/{userId}` key).
   * @format slug
   */
  readonly userId: string;

  /**
   * Artist ID for revenue attribution.
   * @format uuid
   */
  readonly artistId: string;
}

/**
 * Represents the result of a completed purchase, returned from
 * the Yoco checkout callback or webhook confirmation.
 */
export interface PurchaseResult {
  /**
   * Whether the purchase was successful.
   */
  readonly success: boolean;

  /**
   * The purchase record if successful.
   */
  readonly purchase?: Purchase;

  /**
   * Error message if the purchase failed.
   */
  readonly error?: string;

  /**
   * Gateway transaction reference.
   */
  readonly gatewayReference?: string;
}

/**
 * Represents the download information returned from the signed URL worker.
 */
export interface DownloadInfo {
  /**
   * The signed download URL.
   * @format uri
   */
  readonly url: string;

  /**
   * ISO timestamp when the URL expires.
   * @format date-time
   */
  readonly expiresAt: string;

  /**
   * Cache control header value.
   */
  readonly cacheControl: string;
}
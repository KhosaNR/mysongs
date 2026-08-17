/**
 * Represents a user account in the My Songs platform.
 *
 * Maps to the `users` Firestore collection.
 *
 * @interface User
 * @example
 * ```typescript
 * const user: User = {
 *   id: 'firebase_uid_12345',
 *   email: 'fan@domain.co.za',
 *   displayName: 'Sipho Ngwenya',
 *   role: 'listener',
 *   purchasedSongs: ['track_101', 'track_102'],
 *   themePreferences: {
 *     darkMode: true,
 *     artistId: 'artist_01',
 *     albumId: 'album_01'
 *   },
 *   createdAt: new Date('2026-01-15T08:00:00Z')
 * };
 * ```
 */

import { UserRole } from '../../core/constants/navigation.constants';

export type { UserRole };

export interface ThemePreferences {
  /**
   * Whether the user prefers dark mode.
   * @default true
   */
  readonly darkMode?: boolean;

  /**
   * Override to pin a specific artist's theme.
   * @format uuid
   */
  readonly artistId?: string;

  /**
   * Override to pin a specific album's theme.
   * @format uuid
   */
  readonly albumId?: string;

  /**
   * Override to pin a specific song's theme.
   * @format uuid
   */
  readonly songId?: string;
}

export interface User {
  /**
   * Unique application user ID — equals the `users/{userId}` document key.
   * Opaque and deliberately decoupled from the Firebase Auth UID.
   * @format slug
   */
  readonly id: string;

  /**
   * Opaque public user ID (same value as the document key).
   * @format slug
   */
  readonly userId?: string;

  /**
   * Firebase Auth UID of the owning account. Private — used for the
   * auth→user mapping and rules binding; never exposed in public docs.
   */
  readonly authUid?: string;

  /**
   * User's email address.
   * @format email
   */
  readonly email: string;

  /**
   * Display name shown in the UI.
   * @minLength 1
   * @maxLength 100
   */
  readonly displayName?: string;

  /**
   * Role-based access control level.
   * New accounts are granted either 'listener' or 'artist'. 'visitor' is the
   * derived fallback for authenticated sessions with no granted role and is
   * never persisted as a new-account role.
   * @default 'listener'
   */
  readonly role: UserRole;

  /**
   * Array of song IDs the user has purchased.
   * @maxItems 1000
   */
  readonly purchasedSongs?: readonly string[];

  /**
   * User's theme display preferences.
   */
  readonly themePreferences?: ThemePreferences;

  /**
   * User's privacy consent opt-ins (POPIA compliance).
   */
  readonly consent?: UserConsent;

  /**
   * Artist application status (only for users with role='artist').
   * @default undefined
   */
  readonly artistStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';

  /**
   * Linked artistId for artist accounts (references `artists/{artistId}`).
   * @format slug
   */
  readonly artistId?: string;

  /**
   * Admin rejection reason when artistStatus = 'rejected'.
   * @maxLength 500
   */
  readonly rejectionReason?: string | null;

  /**
   * Timestamp when the user account was created.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the user account was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;
}

/**
 * User privacy consent opt-ins (POPIA compliance).
 * All fields default to `false` — opt-in is explicit.
 */
export interface UserConsent {
  /**
   * Consent to receive marketing/promotional emails.
   * @default false
   */
  readonly marketingEmail: boolean;

  /**
   * Consent for data processing and storage.
   * @default false
   */
  readonly dataProcessing: boolean;

  /**
   * Consent to receive WhatsApp messages.
   * @default false
   */
  readonly whatsapp: boolean;
}
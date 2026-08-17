/**
 * Represents a user-submitted report against an artist for moderation.
 * Maps to the `reports` Firestore collection.
 */
export interface ContentReport {
  readonly id?: string;
  /** Public user ID of the reporting user (references `users/{userId}`). */
  readonly reporterId: string;
  readonly artistId: string;
  readonly reason: ReportReason;
  readonly details?: string;
  readonly status: 'open' | 'resolved' | 'dismissed';
  readonly createdAt?: Date;
  readonly resolvedAt?: Date;
  /** Public user ID of the admin who resolved/dismissed the report. */
  readonly resolvedBy?: string;
}

export type ReportReason =
  | 'copyright'
  | 'abuse'
  | 'spam'
  | 'impersonation'
  | 'explicit-content'
  | 'other';
/**
 * Represents a listener's saved playlist.
 *
 * Maps to the `playlists` Firestore collection (owner-only access via rules).
 */
export interface Playlist {
  /**
   * Opaque public playlist ID — equals the `playlists/{playlistId}` key.
   * @format slug
   */
  readonly playlistId: string;

  /**
   * Public application user ID of the playlist owner.
   * @format slug
   */
  readonly userId: string;

  /**
   * Playlist display name.
   * @minLength 1
   * @maxLength 100
   */
  readonly name: string;

  /**
   * Optional short description.
   * @maxLength 300
   */
  readonly description?: string;

  /**
   * Ordered snapshot of song IDs in the playlist.
   * @maxItems 1000
   */
  readonly songIds: readonly string[];

  /**
   * Whether the playlist is publicly shareable. Private by default (omitted or
   * false = owner-only); a public playlist can be opened and copied by anyone,
   * while writes remain owner-only.
   */
  readonly isPublic?: boolean;

  /**
   * Timestamp when the playlist was created.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the playlist was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;
}

/**
 * Playlist document augmented with its Firestore document ID.
 */
export interface PlaylistWithId extends Playlist {
  readonly id: string;
}

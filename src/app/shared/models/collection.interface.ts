/**
 * Represents a public collection curated by an artist from their own songs.
 *
 * Maps to the `collections` Firestore collection. Collections are the
 * artist-side counterpart of a listener's private playlist: always public,
 * only ever created and edited by the owning artist (or an admin), and only
 * containing that artist's own songs. Fans can copy a collection's songs into
 * their own playlists.
 */
export interface Collection {
  /**
   * Opaque public collection ID — equals the `collections/{collectionId}` key.
   * @format slug
   */
  readonly collectionId: string;

  /**
   * Artist document ID of the artist who curated the collection.
   * @format slug
   */
  readonly artistId: string;

  /**
   * Collection display name.
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
   * Ordered snapshot of the artist's own song IDs in the collection.
   * @maxItems 1000
   */
  readonly songIds: readonly string[];

  /**
   * Timestamp when the collection was created.
   * @format date-time
   */
  readonly createdAt?: Date;

  /**
   * Timestamp when the collection was last updated.
   * @format date-time
   */
  readonly updatedAt?: Date;

  /**
   * Soft-delete flag — soft-deleted collections are hidden from public views.
   */
  readonly isDeleted?: boolean;

  /**
   * Timestamp when the collection was soft-deleted.
   * @format date-time
   */
  readonly deletedAt?: Date;
}

/**
 * Collection document augmented with its Firestore document ID.
 */
export interface CollectionWithId extends Collection {
  readonly id: string;
}

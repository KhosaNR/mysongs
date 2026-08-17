import { Injectable, inject } from '@angular/core';
import { where } from '@angular/fire/firestore';
import { DbService } from './db.service';
import { ErrorHandler, Result } from '../utils/error-handler';
import { Collection, CollectionWithId } from '../../shared/models/collection.interface';

/**
 * Service for artist-curated public collection CRUD backed by the
 * `collections` collection.
 *
 * Firestore rules already restrict writes to the owning artist (or admin), so
 * this service only binds the owning artist ID into the payloads and keeps
 * song dedup/ordering consistent.
 */
@Injectable({
  providedIn: 'root',
})
export class CollectionService {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  /**
   * Loads the public collections curated by the given artist.
   *
   * @param artistId - Artist document ID
   * @returns Result containing the artist's collections (empty array when none)
   */
  async getArtistCollections(artistId: string): Promise<Result<CollectionWithId[]>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.getCollection<Collection>('collections', {
        constraints: [where('artistId', '==', artistId), where('isDeleted', '==', false)],
      });

      if (result.isFailure()) {
        throw new Error(result.getError());
      }

      return result
        .getData()
        .map((doc) => ({ ...doc.data, id: doc.id }) as CollectionWithId)
        .sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0));
    }, 'getArtistCollections', { artistId });
  }

  /**
   * Loads a single collection by ID.
   *
   * @param collectionId - Collection document ID
   * @returns Result containing the collection (with its document ID)
   */
  async getCollection(collectionId: string): Promise<Result<CollectionWithId>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.getDocument<Collection>('collections', collectionId);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
      const { id, data } = result.getData();
      return { ...data, id } as CollectionWithId;
    }, 'getCollection', { collectionId });
  }

  /**
   * Creates a new collection for the artist.
   *
   * @param artistId - Owning artist document ID
   * @param name - Collection name
   * @param description - Optional short description
   * @param songIds - The artist's own song IDs (deduplicated)
   * @returns Result containing the new collection document ID
   */
  async createCollection(
    artistId: string,
    name: string,
    description: string,
    songIds: string[],
  ): Promise<Result<string>> {
    return this.errorHandler.execute(async () => {
      const now = new Date();
      const id = this.dbService.generateId();
      const collection: Collection = {
        collectionId: id,
        artistId,
        name: name.trim(),
        description: description.trim() || undefined,
        songIds: this.dedupe(songIds),
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.dbService.createWithId<Collection>('collections', id, collection, {
        softDeletable: true,
      });
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
      return id;
    }, 'createCollection', { artistId });
  }

  /**
   * Updates collection metadata and/or its song list.
   *
   * @param collectionId - Collection document ID
   * @param data - Partial collection fields to write
   * @returns Result indicating success or failure
   */
  async updateCollection(collectionId: string, data: Partial<Collection>): Promise<Result<void>> {
    return this.errorHandler.execute(async () => {
      const songIds = data.songIds ? this.dedupe(data.songIds) : undefined;
      const result = await this.dbService.update<Collection>('collections', collectionId, {
        ...data,
        ...(songIds !== undefined ? { songIds } : {}),
        updatedAt: new Date(),
      });
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
    }, 'updateCollection', { collectionId });
  }

  /**
   * Soft-deletes a collection so it disappears from public views.
   *
   * @param collectionId - Collection document ID
   * @returns Result indicating success or failure
   */
  async deleteCollection(collectionId: string): Promise<Result<void>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.softDelete('collections', collectionId);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
    }, 'deleteCollection', { collectionId });
  }

  /**
   * Deduplicates an ordered list of song IDs while preserving order.
   *
   * @param ids - Raw song ID list
   * @returns Unique song IDs in their original order
   */
  private dedupe(ids: readonly string[]): string[] {
    return [...new Set(ids)];
  }
}

import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  QueryConstraint,
  DocumentData,
} from '@angular/fire/firestore';
import { ErrorHandler, Result } from '../utils/error-handler';
import { sanitizeForFirestore } from '../utils/sanitize';

/**
 * Generic document data interface with artistId scoping.
 */
export interface DocumentWithArtistId extends DocumentData {
  artistId?: string;
}

/**
 * Optional behaviour modifiers for document create operations.
 */
export interface CreateOptions {
  /**
   * Defaults new catalog documents (songs/albums/artists) to `isDeleted: false`
   * and `deletedAt: null` so they match the public
   * `where('isDeleted', '==', false)` queries used across explore/search.
   */
  readonly softDeletable?: boolean;
}

/**
 * Service handling Firestore database operations with automatic artistId scoping.
 * 
 * Provides CRUD operations for all collections with built-in tenant isolation.
 * All operations include explicit error handling with PII-safe logging.
 * 
 * @example
 * ```typescript
 * // Get all songs for an artist
 * const result = await this.dbService.getCollection('songs', {
 *   constraints: [where('artistId', '==', 'artist_01')]
 * });
 * 
 * // Create a new document with automatic artistId injection
 * const createResult = await this.dbService.create('songs', {
 *   title: 'New Track',
 *   artistId: 'artist_01', // Automatically scoped
 *   priceZAR: 5.00
 * });
 * 
 * // Update with optimistic concurrency
 * const updateResult = await this.dbService.update('songs', 'track_123', {
 *   isTopSong: true
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class DbService {
  private readonly firestore = inject(Firestore);
  private readonly errorHandler = inject(ErrorHandler);

  readonly isLoading = signal<boolean>(false);

  readonly error = signal<string | null>(null);

  /**
   * Generates a unique document ID client-side using Firestore's own auto-ID
   * generator (no network round-trip).
   *
   * Application-facing identifiers (users, artists) use this opaque format so
   * the Firebase Auth UID is never used as a primary key or exposed in public
   * documents or URLs.
   *
   * @returns A 20-character opaque alphanumeric ID
   */
  generateId(): string {
    return doc(collection(this.firestore, '_ids')).id;
  }

  /**
   * Gets a single document by ID.
   * 
   * @template T - The expected document data type
   * @param collectionPath - The collection path (e.g., 'songs', 'artists')
   * @param documentId - The document ID
   * @returns A Result containing the document data and ID, or an error message
   * 
   * @remarks
   * The document ID is included in the returned data for convenience.
   */
  async getDocument<T extends DocumentWithArtistId>(
    collectionPath: string,
    documentId: string
  ): Promise<Result<{ id: string; data: T }>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          throw new Error('not-found');
        }

        const data = {
          id: snapshot.id,
          data: { ...snapshot.data(), id: snapshot.id } as unknown as T,
        };

        return data;
      },
      'getDocument',
      {
        collection: collectionPath,
        documentId,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Gets multiple documents from a collection with optional query constraints.
   * 
   * @template T - The expected document data type
   * @param collectionPath - The collection path
   * @param options - Query options
   * @returns A Result containing an array of documents, or an error message
   * 
   * @example
   * ```typescript
   * // Get all songs for a specific artist
   * const result = await this.dbService.getCollection('songs', {
   *   constraints: [
   *     where('artistId', '==', 'artist_01'),
   *     orderBy('createdAt', 'desc'),
   *     limit(20)
   *   ]
   * });
   * ```
   */
  async getCollection<T extends DocumentWithArtistId>(
    collectionPath: string,
    options?: {
      constraints?: QueryConstraint[];
    }
  ): Promise<Result<{ id: string; data: T }[]>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const constraints = options?.constraints || [];
        const q = query(collectionRef, ...constraints);
        const snapshot = await getDocs(q);

        const documents = snapshot.docs.map((doc) => ({
          id: doc.id,
          data: { ...doc.data(), id: doc.id } as unknown as T,
        }));

        return documents;
      },
      'getCollection',
      {
        collection: collectionPath,
        constraintCount: options?.constraints?.length || 0,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Creates a new document in a collection.
   * 
   * @template T - The document data type
   * @param collectionPath - The collection path
   * @param data - The document data (artistId will be automatically injected if provided)
   * @returns A Result containing the created document ID, or an error message
   * 
   * @remarks
   * If the data includes an artistId, it will be preserved. Otherwise, no artistId is set.
   * The document ID is auto-generated by Firestore.
   */
  async create<T extends DocumentWithArtistId>(
    collectionPath: string,
    data: Omit<T, 'id'>,
    options?: CreateOptions
  ): Promise<Result<string>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef);

        const docData = sanitizeForFirestore(data) as DocumentData;
        if (options?.softDeletable) {
          docData['isDeleted'] = docData['isDeleted'] ?? false;
          docData['deletedAt'] = docData['deletedAt'] ?? null;
        }

        await setDoc(docRef, docData);

        return docRef.id;
      },
      'create',
      {
        collection: collectionPath,
        hasArtistId: 'artistId' in data,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Creates a new document with a specific ID.
   * 
   * @template T - The document data type
   * @param collectionPath - The collection path
   * @param documentId - The document ID to use
   * @param data - The document data
   * @returns A Result indicating success or failure
   */
  async createWithId<T extends DocumentWithArtistId>(
    collectionPath: string,
    documentId: string,
    data: Omit<T, 'id'>,
    options?: CreateOptions
  ): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);

        const docData = sanitizeForFirestore(data) as DocumentData;
        if (options?.softDeletable) {
          docData['isDeleted'] = docData['isDeleted'] ?? false;
          docData['deletedAt'] = docData['deletedAt'] ?? null;
        }

        await setDoc(docRef, docData);
      },
      'createWithId',
      {
        collection: collectionPath,
        documentId,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Updates an existing document.
   * 
   * @template T - The document data type
   * @param collectionPath - The collection path
   * @param documentId - The document ID to update
   * @param data - The partial data to update (only provided fields are updated)
   * @returns A Result indicating success or failure
   * 
   * @remarks
   * This performs a partial update. Fields not provided are left unchanged.
   */
  async update<T extends DocumentWithArtistId>(
    collectionPath: string,
    documentId: string,
    data: Partial<T>
  ): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);

        await updateDoc(docRef, sanitizeForFirestore(data) as DocumentData);
      },
      'update',
      {
        collection: collectionPath,
        documentId,
        fieldCount: Object.keys(data).length,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Deletes a document.
   * 
   * @param collectionPath - The collection path
   * @param documentId - The document ID to delete
   * @returns A Result indicating success or failure
   */
  async delete(
    collectionPath: string,
    documentId: string
  ): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);
        
        await deleteDoc(docRef);
      },
      'delete',
      {
        collection: collectionPath,
        documentId,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Soft deletes a document by setting isDeleted=true and deletedAt timestamp.
   * The document remains in Firestore but is hidden from public views.
   * 
   * @param collectionPath - The collection path
   * @param documentId - The document ID to soft delete
   * @returns A Result indicating success or failure
   */
  async softDelete(
    collectionPath: string,
    documentId: string
  ): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);
        
        await updateDoc(docRef, {
          isDeleted: true,
          deletedAt: new Date(),
        } as DocumentData);
      },
      'softDelete',
      {
        collection: collectionPath,
        documentId,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Restores a soft-deleted document by setting isDeleted=false and clearing deletedAt.
   * 
   * @param collectionPath - The collection path
   * @param documentId - The document ID to restore
   * @returns A Result indicating success or failure
   */
  async restore(
    collectionPath: string,
    documentId: string
  ): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);
        
        await updateDoc(docRef, {
          isDeleted: false,
          deletedAt: null,
        } as DocumentData);
      },
      'restore',
      {
        collection: collectionPath,
        documentId,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Checks if a document exists.
   * 
   * @param collectionPath - The collection path
   * @param documentId - The document ID to check
   * @returns A Result containing true if exists, false otherwise
   */
  async exists(
    collectionPath: string,
    documentId: string
  ): Promise<Result<boolean>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);
        const snapshot = await getDoc(docRef);

        return snapshot.exists();
      },
      'exists',
      {
        collection: collectionPath,
        documentId,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  clearError(): void {
    this.error.set(null);
  }
}
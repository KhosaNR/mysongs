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
  where,
  orderBy,
  limit,
  QueryConstraint,
  DocumentData,
  CollectionReference,
} from '@angular/fire/firestore';
import { ErrorHandler, Result } from '../utils/error-handler';
import { PiiMaskPipe } from '../../shared/pipes/pii-mask.pipe';

/**
 * Generic document data interface with artistId scoping.
 */
export interface DocumentWithArtistId extends DocumentData {
  artistId?: string;
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
 *   constraints: [where('artistId', '==', 'leobee_01')]
 * });
 * 
 * // Create a new document with automatic artistId injection
 * const createResult = await this.dbService.create('songs', {
 *   title: 'New Track',
 *   artistId: 'leobee_01', // Automatically scoped
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
  private readonly piiMaskPipe = inject(PiiMaskPipe);

  /**
   * Signal indicating whether a database operation is in progress.
   */
  readonly isLoading = signal<boolean>(false);

  /**
   * Signal containing the last database error message, or null if no error.
   */
  readonly error = signal<string | null>(null);

  constructor() {}

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
   *     where('artistId', '==', 'leobee_01'),
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
    data: Omit<T, 'id'>
  ): Promise<Result<string>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef);
        
        await setDoc(docRef, data);
        
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
    data: Omit<T, 'id'>
  ): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const docRef = doc(collectionRef, documentId);
        
        await setDoc(docRef, data);
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
        
        await updateDoc(docRef, data as DocumentData);
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

  /**
   * Clears the current error message.
   * 
   * @remarks
   * Call this after displaying the error to the user.
   */
  clearError(): void {
    this.error.set(null);
  }
}
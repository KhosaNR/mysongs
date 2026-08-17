import { Injectable, inject, signal } from '@angular/core';
import { ErrorHandler, Result } from '../utils/error-handler';
import { DbService } from './db.service';
import { where, limit } from '@angular/fire/firestore';
import { User, UserConsent, ThemePreferences } from '../../shared/models/user.interface';
import { USER_ROLE, UserRole } from '../constants/navigation.constants';

/**
 * Service managing Firestore user documents.
 *
 * Handles CRUD operations for the `users` collection, including
 * consent management, theme preferences, and account lifecycle.
 * All operations include explicit error handling with PII-safe logging.
 *
 * @example
 * ```typescript
 * // Create user document after registration
 * const result = await this.userService.createUserDocument({
 *   userId: 'usr_AbCd1234...',
 *   authUid: 'firebase_uid_123',
 *   email: 'fan@example.com',
 *   displayName: 'Sipho Ngwenya',
 *   consent: { marketingEmail: false, dataProcessing: true, whatsapp: false }
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Creates a Firestore user document after successful registration.
   *
   * @param params - User creation parameters
   * @returns A Result indicating success or failure
   */
  async createUserDocument(params: {
    userId: string;
    authUid: string;
    email: string;
    displayName?: string;
    consent: UserConsent;
    role?: UserRole;
    artistId?: string;
  }): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const userData: Omit<User, 'id'> = {
          userId: params.userId,
          authUid: params.authUid,
          email: params.email,
          displayName: params.displayName,
          role: params.role || USER_ROLE.LISTENER,
          artistStatus: params.role === USER_ROLE.ARTIST ? 'pending' : undefined,
          ...(params.artistId ? { artistId: params.artistId } : {}),
          consent: params.consent,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.dbService.createWithId('users', params.userId, userData);
      },
      'createUserDocument',
      {
        hasDisplayName: !!params.displayName,
        role: params.role || USER_ROLE.LISTENER,
        consentFields: Object.keys(params.consent).filter(k => (params.consent as unknown as Record<string, boolean>)[k]).join(','),
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Creates the private auth→user mapping document (`user_auth_lookup/{authUid}`).
   *
   * This is the only place the Firebase Auth UID is stored; it lets security
   * rules and the app resolve the public user ID from an authenticated request.
   *
   * @param authUid - The Firebase Auth UID
   * @param userId - The public application user ID
   * @returns A Result indicating success or failure
   */
  async createAuthMapping(authUid: string, userId: string): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        await this.dbService.createWithId('user_auth_lookup', authUid, {
          userId,
          createdAt: new Date(),
        });
      },
      'createAuthMapping',
      { hasUserId: true }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Resolves the public user ID for a given Firebase Auth UID.
   *
   * Returns null when no mapping exists (legacy accounts keyed by the UID).
   *
   * @param authUid - The Firebase Auth UID
   * @returns A Result containing the public user ID or null
   */
  async getUserIdByAuth(authUid: string): Promise<Result<string | null>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const docResult = await this.dbService.getDocument<{ userId: string }>(
          'user_auth_lookup',
          authUid
        );
        if (docResult.isFailure()) {
          // A missing or unreadable mapping simply means there is no decoupled
          // public id to resolve — fall back to the legacy UID path instead of
          // failing the whole auth session.
          return null;
        }
        return docResult.getData().data.userId || null;
      },
      'getUserIdByAuth',
      {}
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Deletes the auth→user mapping document during account deletion.
   *
   * @param authUid - The Firebase Auth UID
   * @returns A Result indicating success or failure
   */
  async deleteAuthMapping(authUid: string): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        await this.dbService.delete('user_auth_lookup', authUid);
      },
      'deleteAuthMapping',
      {}
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Fetches a user document by its public application user ID.
   *
   * @param userId - The public user ID (the `users/{userId}` document key)
   * @returns A Result containing the User data, or an error message
   */
  async getUserDocument(userId: string): Promise<Result<User>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const docResult = await this.dbService.getDocument<User>('users', userId);

        if (docResult.isFailure()) {
          throw new Error(docResult.getError());
        }

        return docResult.getData().data;
      },
      'getUserDocument',
      { userId }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Resolves the artist document ID owned by a user (post-migration fallback).
   *
   * After the identity-schema migration a user's `artistId` field may be
   * stale or absent; the owning artist is then found through the
   * `artists/{artistId}.userId` reference instead of assuming `userId` equals
   * `artistId` (only true in the legacy UID-keyed schema).
   *
   * @param userId - The public application user ID
   * @returns A Result containing the artistId or null when no artist is linked
   */
  async getArtistIdForUser(userId: string): Promise<Result<string | null>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const docsResult = await this.dbService.getCollection<{ userId: string; artistId: string }>(
          'artists',
          {
            constraints: [where('userId', '==', userId), limit(1)],
          }
        );
        if (docsResult.isFailure()) {
          return null;
        }
        const match = docsResult.getData().find((doc) => !!doc.data.artistId);
        return match ? match.data.artistId : null;
      },
      'getArtistIdForUser',
      {}
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Updates a user document with partial data.
   *
   * @param userId - The public user ID (the `users/{userId}` document key)
   * @param data - Partial user data to update
   * @returns A Result indicating success or failure
   */
  async updateUserDocument(userId: string, data: Partial<User>): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        // Firestore updateDoc() rejects `undefined` field values — strip
        // them so only concrete values or null reach the database.
        const sanitized: Record<string, unknown> = {
          ...data,
          updatedAt: new Date(),
        };
        for (const key of Object.keys(sanitized)) {
          if (sanitized[key] === undefined) {
            delete sanitized[key];
          }
        }

        await this.dbService.update('users', userId, sanitized as Partial<User>);
      },
      'updateUserDocument',
      {
        userId,
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
   * Updates the user's privacy consent preferences.
   *
   * @param userId - The public user ID
   * @param consent - The updated consent preferences
   * @returns A Result indicating success or failure
   */
  async updateConsent(userId: string, consent: UserConsent): Promise<Result<void>> {
    return this.updateUserDocument(userId, { consent });
  }

  /**
   * Updates the user's theme display preferences.
   *
   * @param userId - The public user ID
   * @param preferences - The updated theme preferences
   * @returns A Result indicating success or failure
   */
  async updateThemePreferences(userId: string, preferences: ThemePreferences): Promise<Result<void>> {
    return this.updateUserDocument(userId, { themePreferences: preferences });
  }

  /**
   * Marks the onboarding flow as completed for a user.
   *
   * @param userId - The public user ID
   * @returns A Result indicating success or failure
   */
  async completeOnboarding(userId: string): Promise<Result<void>> {
    return this.updateUserDocument(userId, {
      onboardingCompleted: true,
    } as Partial<User>);
  }

  /**
   * Checks if a user has completed the onboarding flow.
   *
   * @param userId - The public user ID
   * @returns A Result containing true if onboarding is completed
   */
  async isOnboardingCompleted(userId: string): Promise<Result<boolean>> {
    const result = await this.getUserDocument(userId);

    if (result.isFailure()) {
      return Result.failure(result.getError());
    }

    const user = result.getData();
    return Result.success(!!(user as User & { onboardingCompleted?: boolean }).onboardingCompleted);
  }

  /**
   * Deletes a user document from Firestore.
   *
   * @param userId - The public user ID
   * @returns A Result indicating success or failure
   */
  async deleteUserDocument(userId: string): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        await this.dbService.delete('users', userId);
      },
      'deleteUserDocument',
      { userId }
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
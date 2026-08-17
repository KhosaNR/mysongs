import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { where } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { DbService } from './db.service';
import { ErrorHandler, Result } from '../utils/error-handler';

/**
 * Service handling POPIA-compliant account deletion with cascading purge.
 *
 * Performs a multi-step deletion process:
 * 1. Deletes the Firestore user document (`users/{userId}`)
 * 2. Deletes all playlists owned by the user
 * 3. Anonymizes purchases_ledger entries (removes PII)
 * 4. Deletes the private auth→user mapping (`user_auth_lookup/{authUid}`)
 * 5. Deletes the Firebase Auth account
 *
 * @example
 * ```typescript
 * const result = await this.accountDeletionService.deleteAccount('password123');
 * if (result.isSuccess()) {
 *   // Redirected to home page
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AccountDeletionService {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Performs full account deletion with cascading data purge (POPIA compliant).
   *
   * @param password - The user's current password for re-authentication
   * @returns A Result indicating success or failure
   *
   * @remarks
   * Steps performed:
   * 1. Delete the Firestore user document (`users/{userId}`)
   * 2. Query and delete all playlists owned by the user (by public userId)
   * 3. Anonymize purchases_ledger entries (clear userId, keep transaction data)
   * 4. Delete the private auth→user mapping (`user_auth_lookup/{authUid}`)
   * 5. Delete the Firebase Auth account
   */
  async deleteAccount(password: string): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.isLoading.set(false);
      this.error.set('No authenticated user.');
      return Result.failure('No authenticated user.');
    }

    const userId = currentUser.userId;
    const authUid = currentUser.uid;
    const logContext = { userId };

    // Step 1: Delete Firestore user document
    const step1Result = await this.errorHandler.execute(
      async () => {
        await this.userService.deleteUserDocument(userId);
      },
      'accountDeletion:deleteUserDoc',
      logContext
    );

    if (step1Result.isFailure()) {
      this.isLoading.set(false);
      this.error.set(step1Result.getError());
      return step1Result;
    }

    // Step 2: Delete all playlists owned by the user
    const step2Result = await this.errorHandler.execute(
      async () => {
        const playlistsResult = await this.dbService.getCollection<{ userId: string }>('playlists', {
          constraints: [where('userId', '==', userId)],
        });

        if (playlistsResult.isSuccess()) {
          for (const playlist of playlistsResult.getData()) {
            await this.dbService.delete('playlists', playlist.id);
          }
        }
      },
      'accountDeletion:deletePlaylists',
      logContext
    );

    if (step2Result.isFailure()) {
      this.isLoading.set(false);
      this.error.set(step2Result.getError());
      return step2Result;
    }

    // Step 3: Anonymize purchases ledger entries
    const step3Result = await this.errorHandler.execute(
      async () => {
        const ledgerResult = await this.dbService.getCollection<{
          userId: string;
          email?: string;
        }>('purchases_ledger', {
          constraints: [where('userId', '==', userId)],
        });

        if (ledgerResult.isSuccess()) {
          for (const purchase of ledgerResult.getData()) {
            try {
              await this.dbService.update('purchases_ledger', purchase.id, {
                userId: '[deleted]',
                email: '[deleted]',
              });
            } catch {
              // Silently continue if update fails — ledger should be immutable from client
              // This is best-effort; server-side cleanup is authoritative
            }
          }
        }
      },
      'accountDeletion:anonymizeLedger',
      logContext
    );

    if (step3Result.isFailure()) {
      this.isLoading.set(false);
      this.error.set(step3Result.getError());
      return step3Result;
    }

    // Step 4: Delete the private auth→user mapping
    const step4Result = await this.errorHandler.execute(
      async () => {
        await this.userService.deleteAuthMapping(authUid);
      },
      'accountDeletion:deleteAuthMapping',
      logContext
    );

    if (step4Result.isFailure()) {
      this.isLoading.set(false);
      this.error.set(step4Result.getError());
      return step4Result;
    }

    // Step 5: Delete Firebase Auth account
    const step5Result = await this.authService.deleteAccount(password);

    this.isLoading.set(false);

    if (step5Result.isFailure()) {
      this.error.set(step5Result.getError());
      return step5Result;
    }

    // Redirect to home after successful deletion
    this.router.navigate(['/']);

    return Result.success(undefined);
  }

  clearError(): void {
    this.error.set(null);
  }
}
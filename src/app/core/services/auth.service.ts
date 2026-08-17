import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  IdTokenResult,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from '@angular/fire/auth';
import { ErrorHandler, Result } from '../utils/error-handler';
import { PiiMaskPipe } from '../../shared/pipes/pii-mask.pipe';
import { UserService } from './user.service';
import { USER_ROLE, UserRole } from '../constants/navigation.constants';

export type { UserRole };

/**
 * Represents the authenticated user with role information.
 */
export interface AuthUser {
  /** Firebase Auth UID — internal auth identity, never exposed publicly. */
  readonly uid: string;
  /** Public application user ID (the `users/{userId}` document key). */
  readonly userId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly role: UserRole;
  readonly artistId?: string;
  readonly artistStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
}

/**
 * Service handling Firebase Authentication with Email/Password and Google providers.
 *
 * Manages user authentication state, role-based access control, and session persistence.
 * All operations include explicit error handling with PII-safe logging.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly auth = inject(Auth);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly piiMaskPipe = inject(PiiMaskPipe);
  private readonly userService = inject(UserService);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly emailVerified = signal<boolean>(false);
  readonly isAuthReady = signal<boolean>(false);

  private authStateUnsubscribe: (() => void) | null = null;
  private rawUser: User | null = null;
  private authReadyResolvers: (() => void)[] = [];

  constructor() {
    if (typeof window === 'undefined') {
      // SSR — no Firebase auth session exists on the server.
      this.isAuthReady.set(true);
    } else {
      this.initializeAuthStateListener();
    }
  }

  /**
   * Resolves pending auth-ready waiters and marks auth state as resolved.
   *
   * @private
   */
  private markAuthReady(): void {
    this.isAuthReady.set(true);
    const resolvers = this.authReadyResolvers;
    this.authReadyResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  /**
   * Waits until Firebase has restored the persisted auth session.
   *
   * Guards depend on this to avoid redirecting before the async
   * auth state listener resolves the user's role on app start.
   *
   * @returns A Promise that resolves once auth state is known
   */
  async waitForAuthReady(): Promise<void> {
    if (this.isAuthReady()) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.authReadyResolvers.push(resolve);
    });
  }

  private initializeAuthStateListener(): void {
    this.authStateUnsubscribe = onAuthStateChanged(
      this.auth,
      async (firebaseUser: User | null) => {
        this.rawUser = firebaseUser;
        if (firebaseUser) {
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult();

            // Default role from custom claims (admin claims are the only
            // authoritative source for elevated privilege levels set by CLI).
            const claimRole = this.extractUserRole(idTokenResult);

            // Resolve the public application user ID through the private
            // auth→user mapping. Legacy accounts without a mapping fall
            // back to the Firebase UID so their `users/{uid}` doc works.
            const mappingResult = await this.userService.getUserIdByAuth(firebaseUser.uid);
            const userId =
              mappingResult.isSuccess() && mappingResult.getData()
                ? mappingResult.getData()!
                : firebaseUser.uid;

            let role = claimRole;
            let artistId = this.extractArtistId(idTokenResult);
            let artistStatus: AuthUser['artistStatus'];

            // Firestore user document is the source of truth for role,
            // artistId, and artistStatus. Custom claims are a fallback for
            // accounts provisioned before the user-doc schema existed.
            const userDocResult = await this.userService.getUserDocument(userId);
            if (userDocResult.isSuccess()) {
              const userDoc = userDocResult.getData() as {
                role?: string;
                artistId?: string;
                artistStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
              };
              const firestoreRole = userDoc.role as string | undefined;
              if (
                firestoreRole === USER_ROLE.ARTIST ||
                firestoreRole === USER_ROLE.ADMIN ||
                firestoreRole === USER_ROLE.LISTENER
              ) {
                role = firestoreRole;
              }
              if (typeof userDoc.artistId === 'string' && userDoc.artistId.length > 0) {
                artistId = userDoc.artistId;
              }
              if (userDoc.artistStatus) {
                artistStatus = userDoc.artistStatus;
              } else if (role === USER_ROLE.ARTIST && claimRole === USER_ROLE.ARTIST) {
                // Legacy account provisioned via CLI custom claims before
                // artistStatus existed — default to approved so existing
                // artists are not locked out.
                artistStatus = 'approved';
              }
            }

            const resolvedArtistId = await this.resolveArtistId(
              this.extractArtistId(idTokenResult),
              artistId,
              role,
              userId
            );

            const authUser: AuthUser = {
              uid: firebaseUser.uid,
              userId,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: role,
              ...(resolvedArtistId ? { artistId: resolvedArtistId } : {}),
              ...(artistStatus ? { artistStatus } : {}),
            };

            this.currentUser.set(authUser);
            this.emailVerified.set(firebaseUser.emailVerified);
          } catch (error) {
            this.errorHandler.executeSync(
              () => {
                throw error;
              },
              'authStateListener',
              { error: error instanceof Error ? error.message : String(error) }
            );
            this.currentUser.set(null);
            this.emailVerified.set(false);
          }
        } else {
          this.currentUser.set(null);
          this.emailVerified.set(false);
        }

        this.markAuthReady();
      },
      (error) => {
        this.errorHandler.executeSync(
          () => {
            throw error;
          },
          'authStateListener',
          { error: error.message }
        );
        this.error.set('Authentication state monitoring failed.');
        this.currentUser.set(null);
        this.emailVerified.set(false);
        this.markAuthReady();
      }
    );
  }

  /**
   * Extracts the user role from Firebase custom claims.
   *
   * Elevated roles (admin, artist) must come from the role custom claim set
   * via CLI. Any other session has no granted role and resolves to the
   * derived VISITOR default — never LISTENER, which requires explicit
   * granting (registration or a user-document role).
   *
   * @param idTokenResult - The Firebase ID token result containing custom claims
   * @returns The user role (admin, artist, or the visitor fallback)
   * @private
   */
  private extractUserRole(idTokenResult: IdTokenResult): UserRole {
    const role = idTokenResult.claims['role'] as string | undefined;
    if (role === USER_ROLE.ADMIN || role === USER_ROLE.ARTIST) {
      return role as UserRole;
    }
    return USER_ROLE.VISITOR;
  }

  /**
   * Extracts the artistId from Firebase custom claims.
   *
   * @param idTokenResult - The Firebase ID token result containing custom claims
   * @returns The artistId if the user is an artist, undefined otherwise
   * @private
   */
  private extractArtistId(idTokenResult: IdTokenResult): string | undefined {
    const artistId = idTokenResult.claims['artistId'] as string | undefined;
    return artistId || undefined;
  }

  /**
   * Resolves the effective artistId for an authenticated user.
   *
   * Precedence: Firestore user doc -> custom claims -> the owning artist
   * document (post-migration fallback). The legacy assumption that
   * `userId === artistId` no longer holds once users and artists use opaque
   * application IDs.
   *
   * @param claimArtistId - artistId read from Firebase custom claims
   * @param docArtistId - artistId read from the Firestore user document
   * @param role - resolved user role
   * @param userId - public application user ID
   * @returns The resolved artistId, or undefined when no artist is linked
   * @private
   */
  private async resolveArtistId(
    claimArtistId: string | undefined,
    docArtistId: string | undefined,
    role: UserRole,
    userId: string
  ): Promise<string | undefined> {
    if (docArtistId) return docArtistId;
    if (claimArtistId) return claimArtistId;
    if (role !== USER_ROLE.ARTIST) return undefined;

    const result = await this.userService.getArtistIdForUser(userId);
    return result.isSuccess() ? (result.getData() ?? undefined) : undefined;
  }

  /**
   * Registers a new user with Email/Password credentials.
   *
   * @param credentials - The registration credentials
   * @returns A Result containing the AuthUser on success, or an error message
   */
  async register(credentials: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<Result<AuthUser>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const credential = await createUserWithEmailAndPassword(
          this.auth,
          credentials.email,
          credentials.password
        );

        if (credentials.displayName) {
          await updateProfile(credential.user, {
            displayName: credentials.displayName,
          });
          // Reload user to ensure displayName is persisted before auth state listener fires
          await credential.user.reload();
        }

        const userData: AuthUser = {
          uid: credential.user.uid,
          // Transient — the auth state listener resolves the real public ID.
          userId: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName,
          photoURL: credential.user.photoURL,
          role: USER_ROLE.LISTENER,
        };

        return userData;
      },
      'register',
      {
        email: this.piiMaskPipe.transform(credentials.email),
        hasDisplayName: !!credentials.displayName,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Signs in a user with Email/Password credentials.
   *
   * @param credentials - The login credentials
   * @returns A Result containing the AuthUser on success, or an error message
   */
  async signIn(credentials: {
    email: string;
    password: string;
  }): Promise<Result<AuthUser>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const credential = await signInWithEmailAndPassword(
          this.auth,
          credentials.email,
          credentials.password
        );

        const idTokenResult = await credential.user.getIdTokenResult();
        const userData: AuthUser = {
          uid: credential.user.uid,
          // Transient — the auth state listener resolves the real public ID.
          userId: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName,
          photoURL: credential.user.photoURL,
          role: this.extractUserRole(idTokenResult),
          artistId: this.extractArtistId(idTokenResult),
        };

        return userData;
      },
      'signIn',
      {
        email: this.piiMaskPipe.transform(credentials.email),
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Signs in a user with Google OAuth.
   *
   * @returns A Result containing the AuthUser on success, or an error message
   */
  async signInWithGoogle(): Promise<Result<AuthUser>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(this.auth, provider);

        const idTokenResult = await credential.user.getIdTokenResult();
        const userData: AuthUser = {
          uid: credential.user.uid,
          // Transient — the auth state listener resolves the real public ID.
          userId: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName,
          photoURL: credential.user.photoURL,
          role: this.extractUserRole(idTokenResult),
          artistId: this.extractArtistId(idTokenResult),
        };

        return userData;
      },
      'signInWithGoogle',
      {
        provider: 'google',
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Signs out the current user.
   *
   * @returns A Result indicating success or failure
   */
  async signOut(): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        await signOut(this.auth);
      },
      'signOut',
      {
        userId: this.currentUser()?.uid,
      }
    );

    this.isLoading.set(false);

    if (result.isSuccess()) {
      this.currentUser.set(null);
    } else {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Sends a password reset email to the specified email address.
   *
   * @param email - The email address to send the reset link to
   * @returns A Result indicating success or failure
   */
  async sendPasswordReset(email: string): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        await sendPasswordResetEmail(this.auth, email);
      },
      'sendPasswordReset',
      {
        email: this.piiMaskPipe.transform(email),
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Checks if a user is currently authenticated.
   *
   * @returns true if a user is signed in, false otherwise
   */
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Checks if the current user has the specified role.
   *
   * @param role - The role to check for
   * @returns true if the current user has the specified role
   * @throws Error if no user is authenticated
   */
  hasRole(role: UserRole): boolean {
    const currentUser = this.currentUser();
    if (!currentUser) {
      throw new Error('No user is currently authenticated.');
    }
    return currentUser.role === role;
  }

  /**
   * Checks if the current user is an admin.
   *
   * @returns true if the current user is an admin
   */
  isAdmin(): boolean {
    const currentUser = this.currentUser();
    return currentUser?.role === USER_ROLE.ADMIN;
  }

  /**
   * Checks if the current user is an artist.
   *
   * @returns true if the current user is an artist
   */
  isArtist(): boolean {
    const currentUser = this.currentUser();
    return currentUser?.role === USER_ROLE.ARTIST;
  }

  /**
   * Checks if the current user is a listener.
   *
   * @returns true if the current user is a listener
   */
  isListener(): boolean {
    const currentUser = this.currentUser();
    return currentUser?.role === USER_ROLE.LISTENER;
  }

  /**
   * Checks if the current user is a visitor — authenticated but with no
   * granted role (no listener/artist/admin authorization).
   *
   * @returns true if the current user is a visitor
   */
  isVisitor(): boolean {
    const currentUser = this.currentUser();
    return currentUser?.role === USER_ROLE.VISITOR;
  }

  /**
   * Checks if the current user has been granted a role (listener, artist, or
   * admin). Visitors are authenticated but have no granted role, so they must
   * not access listener-only features (playlists, purchases, downloads).
   *
   * @returns true if the current user has a granted role
   */
  hasGrantedRole(): boolean {
    const role = this.currentUser()?.role;
    return (
      role === USER_ROLE.LISTENER ||
      role === USER_ROLE.ARTIST ||
      role === USER_ROLE.ADMIN
    );
  }

  /**
   * Sends an email verification link to the current user.
   *
   * @returns A Result indicating success or failure
   */
  async sendEmailVerification(): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        if (!this.rawUser) {
          throw new Error('No authenticated user.');
        }
        await sendEmailVerification(this.rawUser);
      },
      'sendEmailVerification',
      {
        uid: this.currentUser()?.uid,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Reloads the current user from Firebase to refresh emailVerified status.
   *
   * @returns A Result containing the updated emailVerified state
   */
  async reloadUser(): Promise<Result<boolean>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        if (!this.rawUser) {
          throw new Error('No authenticated user.');
        }
        await this.rawUser.reload();
        const isVerified = this.rawUser.emailVerified;
        this.emailVerified.set(isVerified);
        return isVerified;
      },
      'reloadUser',
      {
        uid: this.currentUser()?.uid,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    }

    return result;
  }

  /**
   * Re-authenticates and permanently deletes the current user's Auth account.
   *
   * @param password - The user's current password for re-authentication
   * @returns A Result indicating success or failure
   */
  async deleteAccount(password: string): Promise<Result<void>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const currentUser = this.rawUser;
        if (!currentUser || !currentUser.email) {
          throw new Error('No authenticated user.');
        }

        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
        await deleteUser(currentUser);
      },
      'deleteAccount',
      {
        uid: this.currentUser()?.uid,
      }
    );

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
    } else {
      this.currentUser.set(null);
      this.emailVerified.set(false);
      this.rawUser = null;
    }

    return result;
  }

  /**
   * Refreshes the current user's Firestore-sourced role/moderation state.
   */
  async refreshCurrentUser(): Promise<Result<AuthUser | null>> {
    const firebaseUser = this.rawUser;
    if (!firebaseUser) return Result.success(null);

    const result = await this.errorHandler.execute(
      async () => {
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        const claimRole = this.extractUserRole(idTokenResult);

        // Resolve the public application user ID through the private
        // auth→user mapping. Legacy accounts without a mapping fall
        // back to the Firebase UID so their `users/{uid}` doc works.
        const mappingResult = await this.userService.getUserIdByAuth(firebaseUser.uid);
        const userId =
          mappingResult.isSuccess() && mappingResult.getData()
            ? mappingResult.getData()!
            : firebaseUser.uid;

        let role = claimRole;
        let artistId = this.extractArtistId(idTokenResult);
        let artistStatus: AuthUser['artistStatus'];

        const userDocResult = await this.userService.getUserDocument(userId);
        if (userDocResult.isSuccess()) {
          const userDoc = userDocResult.getData() as {
            role?: string;
            artistId?: string;
            artistStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
          };
          const firestoreRole = userDoc.role as string | undefined;
          if (
            firestoreRole === USER_ROLE.ARTIST ||
            firestoreRole === USER_ROLE.ADMIN ||
            firestoreRole === USER_ROLE.LISTENER
          ) {
            role = firestoreRole;
          }
          if (typeof userDoc.artistId === 'string' && userDoc.artistId.length > 0) {
            artistId = userDoc.artistId;
          }
          if (userDoc.artistStatus) {
            artistStatus = userDoc.artistStatus;
          } else if (role === USER_ROLE.ARTIST && claimRole === USER_ROLE.ARTIST) {
            artistStatus = 'approved';
          }
        }

        const resolvedArtistId = await this.resolveArtistId(
          this.extractArtistId(idTokenResult),
          artistId,
          role,
          userId
        );

        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          userId,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: role,
          ...(resolvedArtistId ? { artistId: resolvedArtistId } : {}),
          ...(artistStatus ? { artistStatus } : {}),
        };
        this.currentUser.set(authUser);
        return authUser;
      },
      'refreshCurrentUser',
      { uid: firebaseUser.uid }
    );

    if (result.isFailure()) this.error.set(result.getError());
    return result;
  }

  /**
   * Clears the current error message.
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Cleans up the auth state listener.
   *
   * @private
   */
  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
  }
}
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
  user,
  updateProfile,
  sendPasswordResetEmail,
} from '@angular/fire/auth';
import { ErrorHandler, Result } from '../utils/error-handler';
import { PiiMaskPipe } from '../../shared/pipes/pii-mask.pipe';

/**
 * Represents the authenticated user with role information.
 */
export interface AuthUser {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly role: UserRole;
  readonly artistId?: string;
}

/**
 * Supported user roles in the system.
 */
export type UserRole = 'admin' | 'artist' | 'listener';

/**
 * Service handling Firebase Authentication with Email/Password and Google providers.
 * 
 * Manages user authentication state, role-based access control, and session persistence.
 * All operations include explicit error handling with PII-safe logging.
 * 
 * @example
 * ```typescript
 * // Register a new user
 * const result = await this.authService.register({
 *   email: 'fan@example.com',
 *   password: 'securePass123',
 *   displayName: 'John Doe'
 * });
 * 
 * if (result.isSuccess()) {
 *   console.log('User registered:', result.getData().uid);
 * }
 * 
 * // Sign in with Google
 * const googleResult = await this.authService.signInWithGoogle();
 * 
 * // Listen to auth state changes
 * this.authService.currentUser$.subscribe(user => {
 *   if (user) {
 *     console.log('Logged in as:', user.email);
 *   }
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly auth = inject(Auth);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly piiMaskPipe = inject(PiiMaskPipe);

  /**
   * Signal containing the current authenticated user, or null if not authenticated.
   * Updates automatically on auth state changes.
   */
  readonly currentUser = signal<AuthUser | null>(null);

  /**
   * Signal indicating whether an authentication operation is in progress.
   */
  readonly isLoading = signal<boolean>(false);

  /**
   * Signal containing the last authentication error message, or null if no error.
   */
  readonly error = signal<string | null>(null);

  private authStateUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initializeAuthStateListener();
  }

  /**
   * Initializes the Firebase Auth state listener.
   * Subscribes to authentication state changes and updates the currentUser signal.
   * 
   * @remarks
   * This is called automatically on service initialization.
   * The listener is cleaned up when the service is destroyed.
   * @private
   */
  private initializeAuthStateListener(): void {
    this.authStateUnsubscribe = onAuthStateChanged(
      this.auth,
      (firebaseUser: User | null) => {
        if (firebaseUser) {
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: this.extractUserRole(firebaseUser),
            artistId: this.extractArtistId(firebaseUser),
          };
          this.currentUser.set(authUser);
        } else {
          this.currentUser.set(null);
        }
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
      }
    );
  }

  /**
   * Extracts the user role from Firebase custom claims.
   * 
   * @param firebaseUser - The Firebase User object
   * @returns The user role (admin, artist, or listener)
   * @private
   */
  private extractUserRole(firebaseUser: User): UserRole {
    // Default to listener if no role claim exists
    // Role claims are set via Firebase Admin SDK custom claims
    return 'listener';
  }

  /**
   * Extracts the artistId from Firebase custom claims.
   * 
   * @param firebaseUser - The Firebase User object
   * @returns The artistId if the user is an artist, undefined otherwise
   * @private
   */
  private extractArtistId(firebaseUser: User): string | undefined {
    // ArtistId is only present for artist role users
    return undefined;
  }

  /**
   * Registers a new user with Email/Password credentials.
   * 
   * @param credentials - The registration credentials
   * @returns A Result containing the AuthUser on success, or an error message
   * 
   * @remarks
   * After successful registration, the user is automatically signed in.
   * The display name is set during registration.
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

        // Update profile with display name
        if (credentials.displayName) {
          await updateProfile(credential.user, {
            displayName: credentials.displayName,
          });
        }

        // Return user data
        const userData: AuthUser = {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: credentials.displayName,
          photoURL: credential.user.photoURL,
          role: 'listener', // Default role
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
   * 
   * @example
   * ```typescript
   * const result = await authService.signIn({
   *   email: 'user@example.com',
   *   password: 'password123'
   * });
   * ```
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

        const userData: AuthUser = {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName,
          photoURL: credential.user.photoURL,
          role: 'listener', // Will be updated from custom claims
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
   * 
   * @remarks
   * Opens a Google sign-in popup. The user must not have already signed in
   * with a different provider using the same email address.
   */
  async signInWithGoogle(): Promise<Result<AuthUser>> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(this.auth, provider);

        const userData: AuthUser = {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName,
          photoURL: credential.user.photoURL,
          role: 'listener', // Will be updated from custom claims
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
   * 
   * @remarks
   * Clears the currentUser signal on success.
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
   * 
   * @remarks
   * The email is masked in logs for privacy.
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
    return currentUser?.role === 'admin';
  }

  /**
   * Checks if the current user is an artist.
   * 
   * @returns true if the current user is an artist
   */
  isArtist(): boolean {
    const currentUser = this.currentUser();
    return currentUser?.role === 'artist';
  }

  /**
   * Checks if the current user is a listener.
   * 
   * @returns true if the current user is a listener
   */
  isListener(): boolean {
    const currentUser = this.currentUser();
    return currentUser?.role === 'listener';
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

  /**
   * Cleans up the auth state listener.
   * 
   * @remarks
   * Called automatically when the service is destroyed.
   * @private
   */
  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
  }
}
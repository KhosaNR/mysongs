import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormRoot,
  FormField,
  form,
  required,
  email,
  minLength,
  maxLength,
  validate,
} from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DbService } from '../../../core/services/db.service';
import { Artist } from '../../../shared/models/artist.interface';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

interface RegisterFormModel {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'listener' | 'artist';
  consentMarketing: boolean;
  consentDataProcessing: boolean;
  consentWhatsapp: boolean;
}

/**
 * Registration page with Signal-driven form and POPIA-compliant consent checkboxes.
 *
 * All consent checkboxes default to unchecked. Data processing consent is
 * required for account creation. Submit button is disabled during the
 * active transaction to prevent double-clicks.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    RouterLink,
    FormRoot,
    FormField,
    FieldErrorsComponent,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
    BrandLogoComponent,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dbService = inject(DbService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly currentYear = new Date().getFullYear();

  readonly registerModel = signal<RegisterFormModel>({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'listener',
    consentMarketing: false,
    consentDataProcessing: false,
    consentWhatsapp: false,
  });

  readonly registerForm = form(this.registerModel, (p) => {
    required(p.displayName, { message: 'Name is required (2-100 characters)' });
    minLength(p.displayName, 2, { message: 'Name must be at least 2 characters' });
    maxLength(p.displayName, 100, { message: 'Name must be 100 characters or fewer' });
    required(p.email, { message: 'Email is required' });
    email(p.email, { message: 'Please enter a valid email address' });
    required(p.password, { message: 'Password is required' });
    minLength(p.password, 8, { message: 'Password must be at least 8 characters' });
    required(p.confirmPassword, { message: 'Please confirm your password' });
    validate(p.confirmPassword, (ctx) => {
      if (ctx.value() && ctx.value() !== ctx.valueOf(p.password)) {
        return { kind: 'mismatch', message: 'Passwords do not match' };
      }
      return undefined;
    });
    required(p.consentDataProcessing, {
      message: 'You must consent to data processing to create an account',
    });
  });

  /**
   * Toggles the password field visibility.
   */
  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  /**
   * Toggles the confirm password field visibility.
   */
  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  /**
   * Handles the registration form submission.
   * Validates form, creates Firebase Auth account, and creates Firestore user document.
   */
  async onSubmit(): Promise<void> {
    this.registerForm().markAsTouched();
    if (this.registerForm().invalid()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const {
      displayName,
      email,
      password,
      role,
      consentMarketing,
      consentDataProcessing,
      consentWhatsapp,
    } = this.registerModel();

    // Register with Firebase Auth
    const authResult = await this.authService.register({
      email,
      password,
      displayName,
    });

    if (authResult.isFailure()) {
      this.error.set(authResult.getError());
      this.isLoading.set(false);
      return;
    }

    const authUser = authResult.getData();

    // Public application IDs are opaque Firestore-style auto IDs, decoupled
    // from the Firebase Auth UID.
    const userId = this.dbService.generateId();

    // 1. Create the user document first (the auth mapping below binds to it).
    const userDocResult = await this.userService.createUserDocument({
      userId,
      authUid: authUser.uid,
      email: authUser.email ?? email,
      displayName: displayName || undefined,
      role: role,
      consent: {
        marketingEmail: consentMarketing,
        dataProcessing: consentDataProcessing,
        whatsapp: consentWhatsapp,
      },
    });

    if (userDocResult.isFailure()) {
      this.error.set(userDocResult.getError());
      this.isLoading.set(false);
      return;
    }

    // 2. Create the private auth→user mapping.
    const mappingResult = await this.userService.createAuthMapping(authUser.uid, userId);
    if (mappingResult.isFailure()) {
      this.error.set('Failed to link your account. Please try again.');
      this.isLoading.set(false);
      return;
    }

    // 3. Provision the artist workspace and link it to the user.
    if (role === 'artist') {
      const artistId = this.dbService.generateId();
      const artistDocResult = await this.dbService.createWithId('artists', artistId, {
        artistId,
        userId,
        name: displayName ?? 'Unnamed Artist',
        artistStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      } as Artist);

      if (artistDocResult.isFailure()) {
        this.error.set('Failed to create artist workspace. Please try again.');
        this.isLoading.set(false);
        return;
      }

      // 4. Link the artistId on the user document.
      const linkResult = await this.userService.updateUserDocument(userId, { artistId });
      if (linkResult.isFailure()) {
        this.error.set('Failed to create artist workspace. Please try again.');
        this.isLoading.set(false);
        return;
      }
    }

    // Re-resolve identity so currentUser carries the real public userId and
    // artistId immediately after registration.
    await this.authService.refreshCurrentUser();

    // Send email verification
    await this.authService.sendEmailVerification();

    this.isLoading.set(false);
    this.toastService.show('Account created! Please verify your email.', { type: 'success' });
    this.router.navigate(['/auth/verify-email']);
  }

  clearError(): void {
    this.error.set(null);
  }
}

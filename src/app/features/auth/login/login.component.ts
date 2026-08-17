import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormRoot, FormField, form, required, email, minLength } from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';
import { USER_ROLE, ROLE_LANDING } from '../../../core/constants/navigation.constants';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

interface LoginFormModel {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Login page with email/password and Google OAuth sign-in options.
 *
 * Supports return URL redirect after successful authentication.
 * Submit button is disabled during the active transaction.
 */
@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal<boolean>(false);
  readonly googleLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly currentYear = new Date().getFullYear();

  readonly loginModel = signal<LoginFormModel>({ email: '', password: '', rememberMe: false });

  readonly loginForm = form(this.loginModel, (p) => {
    required(p.email, { message: 'Email is required' });
    email(p.email, { message: 'Please enter a valid email address' });
    required(p.password, { message: 'Password is required' });
    minLength(p.password, 8, { message: 'Password must be at least 8 characters' });
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  /**
   * Returns the redirect URL after successful login based on user role.
   * Priority: returnUrl (if present) → role-based landing page → explore
   * @param user - The authenticated user from sign-in result
   */
  private getReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      return returnUrl;
    }

    const currentUser = this.authService.currentUser();
    if (currentUser) {
      return ROLE_LANDING[currentUser.role];
    }

    return ROLE_LANDING[USER_ROLE.LISTENER];
  }

  async onFormSubmit(): Promise<void> {
    this.loginForm().markAsTouched();
    if (this.loginForm().invalid()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const { email, password } = this.loginModel();

    const result = await this.authService.signIn({
      email,
      password,
    });

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
      return;
    }

    this.toastService.show('Welcome back!', { type: 'success' });
    const redirectUrl = this.getReturnUrl();
    this.router.navigateByUrl(redirectUrl);
  }

  async signInWithGoogle(): Promise<void> {
    this.googleLoading.set(true);
    this.error.set(null);

    const result = await this.authService.signInWithGoogle();

    this.googleLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
      return;
    }

    this.toastService.show('Signed in with Google!', { type: 'success' });
    const redirectUrl = this.getReturnUrl();
    this.router.navigateByUrl(redirectUrl);
  }

  clearError(): void {
    this.error.set(null);
  }
}

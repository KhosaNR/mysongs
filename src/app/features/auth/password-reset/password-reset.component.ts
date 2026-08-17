import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormRoot, FormField, form, required, email } from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';

interface ResetFormModel {
  email: string;
}

/**
 * Password reset page.
 *
 * Allows users to request a password reset email.
 * Shows success message after email is sent.
 */
@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [
    RouterLink,
    FormRoot,
    FormField,
    FieldErrorsComponent,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
  ],
  templateUrl: './password-reset.component.html',
  styleUrls: ['./password-reset.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordResetComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly emailSent = signal<boolean>(false);

  readonly resetModel = signal<ResetFormModel>({ email: '' });

  readonly resetForm = form(this.resetModel, (p) => {
    required(p.email, { message: 'Email is required' });
    email(p.email, { message: 'Please enter a valid email address' });
  });

  async onSubmit(): Promise<void> {
    this.resetForm().markAsTouched();
    if (this.resetForm().invalid()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const { email } = this.resetModel();

    const result = await this.authService.sendPasswordReset(email);

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
      return;
    }

    this.emailSent.set(true);
    this.toastService.show('Password reset email sent!', { type: 'success' });
  }

  clearError(): void {
    this.error.set(null);
  }
}

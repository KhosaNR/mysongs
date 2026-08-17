import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

/**
 * Email verification page shown after registration.
 *
 * Allows users to resend the verification email and check if their
 * email has been verified. Auto-checks every 5 seconds.
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorBannerComponent, BrandLogoComponent],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(false);
  readonly isChecking = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly isVerified = signal<boolean>(false);
  readonly resendDisabled = signal<boolean>(false);
  readonly resendCountdown = signal<number>(0);
  readonly currentYear = new Date().getFullYear();

  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startAutoCheck();
  }

  /**
   * Starts an interval that checks email verification status every 5 seconds.
   */
  private startAutoCheck(): void {
    this.checkInterval = setInterval(async () => {
      if (this.isVerified()) {
        return;
      }

      this.isChecking.set(true);
      const result = await this.authService.reloadUser();
      this.isChecking.set(false);

      if (result.isSuccess() && result.getData()) {
        this.isVerified.set(true);
        this.toastService.show('Email verified!', { type: 'success' });

        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }

        // Redirect to onboarding after short delay
        setTimeout(() => {
          this.router.navigate(['/onboarding']);
        }, 2000);
      }
    }, 5000);
  }

  /**
   * Resends the email verification link.
   * Has a 60-second cooldown to prevent spam.
   */
  async resendVerification(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.authService.sendEmailVerification();

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
      return;
    }

    this.toastService.show('Verification email sent!', { type: 'success' });

    // Start 60-second cooldown
    this.resendDisabled.set(true);
    this.resendCountdown.set(60);

    const countdownInterval = setInterval(() => {
      this.resendCountdown.update((count) => {
        if (count <= 1) {
          clearInterval(countdownInterval);
          this.resendDisabled.set(false);
          return 0;
        }
        return count - 1;
      });
    }, 1000);
  }

  clearError(): void {
    this.error.set(null);
  }
}

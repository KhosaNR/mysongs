import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

/**
 * Onboarding flow for first-time users after email verification.
 *
 * Shows a welcome message, allows theme preference selection,
 * and marks onboarding as completed.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorBannerComponent, BrandLogoComponent],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly currentStep = signal<number>(1);
  readonly totalSteps = 3;
  readonly currentYear = new Date().getFullYear();

  /**
   * Advances to the next onboarding step.
   */
  nextStep(): void {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update((step) => step + 1);
    }
  }

  /**
   * Goes back to the previous onboarding step.
   */
  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((step) => step - 1);
    }
  }

  /**
   * Completes the onboarding flow and redirects to the home page.
   */
  async completeOnboarding(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.error.set('You must be signed in to complete onboarding.');
      this.isLoading.set(false);
      return;
    }

    const result = await this.userService.completeOnboarding(currentUser.userId);

    this.isLoading.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
      return;
    }

    this.toastService.show('Welcome to My Songs!', { type: 'success' });
    this.router.navigate(['/']);
  }

  clearError(): void {
    this.error.set(null);
  }
}

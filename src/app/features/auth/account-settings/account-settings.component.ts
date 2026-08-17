import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, required, maxLength, disabled } from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { AccountDeletionService } from '../../../core/services/account-deletion.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { ModalDialogComponent } from '../../../shared/components/modal-dialog/modal-dialog.component';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';
import { UserConsent } from '../../../shared/models/user.interface';

interface SettingsFormModel {
  displayName: string;
  consentMarketing: boolean;
  consentDataProcessing: boolean;
  consentWhatsapp: boolean;
}

/**
 * Account settings page for managing consent, display name, and account deletion.
 *
 * Features:
 * - Update display name
 * - Toggle privacy consent preferences
 * - Delete account with confirmation modal (POPIA compliant)
 */
@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [
    RouterLink,
    FormField,
    FieldErrorsComponent,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
    ModalDialogComponent,
  ],
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsComponent {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly accountDeletionService = inject(AccountDeletionService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly isDeleting = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly showDeleteModal = signal<boolean>(false);
  readonly deleteConfirmText = signal<string>('');
  readonly deletePassword = signal<string>('');
  readonly deleteAttempted = signal<boolean>(false);
  readonly modalError = signal<string | null>(null);

  readonly settingsModel = signal<SettingsFormModel>({
    displayName: '',
    consentMarketing: false,
    consentDataProcessing: false,
    consentWhatsapp: false,
  });

  readonly settingsForm = form(this.settingsModel, (p) => {
    required(p.displayName, { message: 'Display name is required' });
    maxLength(p.displayName, 100, { message: 'Display name must be 100 characters or fewer' });
    // Once data-processing consent has been accepted it is locked forever.
    disabled(p.consentDataProcessing, { when: (ctx) => ctx.value() === true });
  });

  /**
   * Once data-processing consent has been accepted (true), it is locked and can never be changed.
   * This derived signal drives the "locked" note in the template.
   */
  readonly isDataProcessingLocked = computed(
    () => this.settingsModel().consentDataProcessing === true,
  );

  constructor() {
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.error.set('You must be signed in to manage account settings.');
      this.isLoading.set(false);
      return;
    }

    const result = await this.userService.getUserDocument(currentUser.userId);

    if (result.isFailure()) {
      this.error.set(result.getError());
      this.isLoading.set(false);
      return;
    }

    const user = result.getData();

    this.settingsModel.set({
      displayName: user.displayName ?? currentUser.displayName ?? '',
      consentMarketing: user.consent?.marketingEmail ?? false,
      consentDataProcessing: user.consent?.dataProcessing ?? false,
      consentWhatsapp: user.consent?.whatsapp ?? false,
    });

    this.isLoading.set(false);
  }

  async saveSettings(): Promise<void> {
    this.settingsForm().markAsTouched();
    if (this.settingsForm().invalid()) {
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.error.set('You must be signed in.');
      this.isSaving.set(false);
      return;
    }

    const { displayName, consentMarketing, consentDataProcessing, consentWhatsapp } =
      this.settingsModel();

    const consent: UserConsent = {
      marketingEmail: consentMarketing,
      dataProcessing: consentDataProcessing,
      whatsapp: consentWhatsapp,
    };

    const result = await this.userService.updateUserDocument(currentUser.userId, {
      displayName: displayName || undefined,
      consent,
    });

    this.isSaving.set(false);

    if (result.isFailure()) {
      this.error.set(result.getError());
      return;
    }

    this.toastService.show('Settings saved!', { type: 'success' });
  }

  openDeleteModal(): void {
    this.showDeleteModal.set(true);
    this.deleteConfirmText.set('');
    this.deletePassword.set('');
    this.deleteAttempted.set(false);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deleteConfirmText.set('');
    this.deletePassword.set('');
    this.deleteAttempted.set(false);
  }

  async confirmDeleteAccount(): Promise<void> {
    this.deleteAttempted.set(true);
    if (this.deleteConfirmText() !== 'DELETE' || !this.deletePassword()) {
      this.modalError.set('Please type DELETE and enter your password.');
      return;
    }

    this.isDeleting.set(true);
    this.modalError.set(null);

    const result = await this.accountDeletionService.deleteAccount(this.deletePassword());

    this.isDeleting.set(false);

    if (result.isFailure()) {
      this.modalError.set(result.getError());
      return;
    }

    // Account deletion handled by service (redirects to home)
    this.closeDeleteModal();
  }

  clearError(): void {
    this.error.set(null);
  }

  clearModalError(): void {
    this.modalError.set(null);
  }
}

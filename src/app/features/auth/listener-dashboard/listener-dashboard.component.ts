import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DbService } from '../../../core/services/db.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { Purchase } from '../../../shared/models/purchase.interface';

/**
 * Listener dashboard showing purchased songs and download access.
 *
 * Queries the purchases_ledger for the current user's purchases
 * and displays them with download links.
 */
@Component({
  selector: 'app-listener-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    LoadingSpinnerComponent,
    ErrorBannerComponent,
  ],
  templateUrl: './listener-dashboard.component.html',
  styleUrls: ['./listener-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListenerDashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dbService = inject(DbService);

  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly purchases = signal<Purchase[]>([]);
  readonly userDisplayName = signal<string>('');

  constructor() {
    this.loadDashboard();
  }

  private async loadDashboard(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.error.set('You must be signed in to view your dashboard.');
      this.isLoading.set(false);
      return;
    }

    this.userDisplayName.set(currentUser.displayName ?? 'Listener');

    // Load user document for display name
    const userResult = await this.userService.getUserDocument(currentUser.userId);
    if (userResult.isSuccess()) {
      const userData = userResult.getData();
      if (userData.displayName) {
        this.userDisplayName.set(userData.displayName);
      }
    }

    // Load purchases from ledger
    const ledgerResult = await this.dbService.getCollection<Purchase>('purchases_ledger', {
      constraints: [],
    });

    if (ledgerResult.isFailure()) {
      this.error.set(ledgerResult.getError());
      this.isLoading.set(false);
      return;
    }

    const userPurchases = ledgerResult
      .getData()
      .filter((p) => p.data.userId === currentUser.userId && p.data.status === 'completed')
      .map((p) => p.data);

    this.purchases.set(userPurchases);
    this.isLoading.set(false);
  }

  clearError(): void {
    this.error.set(null);
  }
}
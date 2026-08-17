import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArtistService, ArtistApplication } from '../../../../core/services/artist.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../../shared/components/error-banner/error-banner.component';

@Component({
  selector: 'app-artist-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent, ErrorBannerComponent],
  templateUrl: './artist-approvals.component.html',
  styleUrl: './artist-approvals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtistApprovalsComponent {
  private readonly artistService = inject(ArtistService);

  readonly applications = signal<ArtistApplication[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly rejectionReasons = signal<Record<string, string>>({});
  readonly busyUserId = signal<string | null>(null);

  constructor() {
    this.loadApplications();
  }

  async loadApplications(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    const result = await this.artistService.getPendingApplications();
    if (result.isFailure()) {
      this.error.set(result.getError());
    } else {
      this.applications.set(result.getData());
    }
    this.isLoading.set(false);
  }

  async approve(userId: string, artistId: string, displayName?: string): Promise<void> {
    this.busyUserId.set(userId);
    this.error.set(null);
    this.successMessage.set(null);

    const result = await this.artistService.approveArtist(userId, artistId, displayName);
    if (result.isFailure()) {
      this.error.set(result.getError());
    } else {
      this.successMessage.set('Artist approved.');
      await this.loadApplications();
    }
    this.busyUserId.set(null);
  }

  async reject(userId: string, artistId: string): Promise<void> {
    const reason = (this.rejectionReasons()[userId] || '').trim();
    if (!reason) {
      this.error.set('A rejection reason is required.');
      return;
    }

    this.busyUserId.set(userId);
    this.error.set(null);
    this.successMessage.set(null);

    const result = await this.artistService.rejectArtist(userId, artistId, reason);
    if (result.isFailure()) {
      this.error.set(result.getError());
    } else {
      this.successMessage.set('Artist application rejected.');
      await this.loadApplications();
    }
    this.busyUserId.set(null);
  }

  onReasonChange(userId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rejectionReasons.update((reasons) => ({ ...reasons, [userId]: value }));
  }

  clearError(): void {
    this.error.set(null);
  }

  clearSuccess(): void {
    this.successMessage.set(null);
  }
}
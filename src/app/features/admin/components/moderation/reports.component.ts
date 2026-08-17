import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../../core/services/report.service';
import { ContentReport } from '../../../../shared/models/report.interface';
import { AuthService } from '../../../../core/services/auth.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorBannerComponent } from '../../../../shared/components/error-banner/error-banner.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent, ErrorBannerComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly reportService = inject(ReportService);
  private readonly authService = inject(AuthService);

  readonly reports = signal<ContentReport[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyReportId = signal<string | null>(null);

  constructor() {
    this.loadReports();
  }

  async loadReports(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.reportService.getReports('open');
    if (result.isFailure()) {
      this.error.set(result.getError());
    } else {
      this.reports.set(result.getData());
    }
    this.isLoading.set(false);
  }

  async resolve(reportId: string, resolved: boolean): Promise<void> {
    const adminUserId = this.authService.currentUser()?.userId;
    if (!adminUserId) return;

    this.busyReportId.set(reportId);
    this.error.set(null);

    const result = await this.reportService.resolveReport(reportId, adminUserId, resolved);
    if (result.isFailure()) {
      this.error.set(result.getError());
    } else {
      await this.loadReports();
    }
    this.busyReportId.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
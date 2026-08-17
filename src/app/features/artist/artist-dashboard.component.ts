import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../core/services/db.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandler } from '../../core/utils/error-handler';
import { USER_ROLE } from '../../core/constants/navigation.constants';

interface StreamingStat {
  trackId: string;
  trackTitle: string;
  streamCount: number;
  lastStreamed: Date;
}

interface SalesMetric {
  period: string;
  totalSales: number;
  totalRevenue: number;
  purchaseCount: number;
}

interface VisitorAnalytics {
  totalVisitors: number;
  uniqueVisitors: number;
  topCountries: { country: string; count: number }[];
  topDevices: { device: string; count: number }[];
  pageViews: number;
}

@Component({
  selector: 'app-artist-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-dashboard.component.html',
  styleUrl: './artist-dashboard.component.scss'
})
export class ArtistDashboardComponent implements OnInit {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly isArtist = computed(() => this.authService.currentUser()?.role === USER_ROLE.ARTIST);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedPeriod = signal('7d');

  readonly streamingStats = signal<StreamingStat[]>([]);
  readonly salesMetrics = signal<SalesMetric[]>([]);
  readonly visitorAnalytics = signal<VisitorAnalytics | null>(null);

  readonly summaryStats = signal({
    totalStreams: 0,
    totalRevenue: 0,
    totalPurchases: 0,
    totalVisitors: 0,
  });

  readonly dashboardTitle = computed(() => {
    return this.isArtist() ? 'My Performance' : 'Platform Overview';
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Load streaming stats (placeholder - would come from analytics collection)
      const streamingResult = await this.dbService.getCollection<StreamingStat>('streaming_analytics', {
        constraints: [],
      });

      if (streamingResult.isSuccess()) {
        const streamingData = streamingResult.getData();
        this.streamingStats.set(streamingData.map(doc => doc.data));
        this.summaryStats.update(stats => ({
          ...stats,
          totalStreams: streamingData.reduce((sum, doc) => sum + (doc.data.streamCount || 0), 0),
        }));
      }

      // Load sales metrics from purchases_ledger
      const salesResult = await this.dbService.getCollection<{ purchaseType: string; amount: number; createdAt: Date }>('purchases_ledger', {
        constraints: [],
      });

      if (salesResult.isSuccess()) {
        const salesData = salesResult.getData();
        const totalRevenue = salesData.reduce((sum, doc) => sum + (doc.data.amount || 0), 0);
        const totalPurchases = salesData.length;

        this.summaryStats.update(stats => ({
          ...stats,
          totalRevenue,
          totalPurchases,
        }));

        // Group by period (simplified - would need proper date grouping in production)
        this.salesMetrics.set([
          {
            period: 'Last 7 days',
            totalSales: totalPurchases,
            totalRevenue: totalRevenue,
            purchaseCount: totalPurchases,
          },
        ]);
      }

      // Load visitor analytics (placeholder - would come from analytics collection)
      const visitorResult = await this.dbService.getCollection<VisitorAnalytics>('visitor_analytics', {
        constraints: [],
      });

      if (visitorResult.isSuccess()) {
        const visitorData = visitorResult.getData();
        if (visitorData.length > 0) {
          this.visitorAnalytics.set(visitorData[0].data);
          this.summaryStats.update(stats => ({
            ...stats,
            totalVisitors: visitorData[0].data.totalVisitors,
          }));
        }
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      this.isLoading.set(false);
    }
  }

  onPeriodChange(period: string): void {
    this.selectedPeriod.set(period);
    this.loadDashboardData();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount / 100); // Assuming amount is in cents
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-ZA').format(num);
  }

  clearError(): void {
    this.error.set(null);
  }
}
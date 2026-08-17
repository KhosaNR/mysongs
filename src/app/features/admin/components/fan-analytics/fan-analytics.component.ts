import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../../../core/services/db.service';
import { ErrorHandler } from '../../../../core/utils/error-handler';

interface FanAnalytics {
  id: string;
  period: string;
  totalListeners: number;
  newListeners: number;
  topTracks: { trackId: string; title: string; playCount: number }[];
  topLocations: { country: string; city: string; listenerCount: number }[];
  deviceBreakdown: { device: string; count: number; percentage: number }[];
  peakListeningHours: { hour: number; count: number }[];
  generatedAt: Date;
}

@Component({
  selector: 'app-fan-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fan-analytics.component.html',
  styleUrl: './fan-analytics.component.scss'
})
export class FanAnalyticsComponent {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly analytics = signal<FanAnalytics[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedPeriod = signal('7d');
  readonly isGenerating = signal(false);

  constructor() {
    this.loadAnalytics();
  }

  async loadAnalytics(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.getCollection<FanAnalytics>('fan_analytics', {
      constraints: [],
    });

    this.isLoading.set(false);

    if (result.isSuccess()) {
      const analyticsData = result.getData();
      this.analytics.set(analyticsData.map(doc => doc.data));
    } else {
      this.error.set(result.getError());
    }
  }

  async generateAnalytics(): Promise<void> {
    this.isGenerating.set(true);
    this.error.set(null);

    try {
      // In a real implementation, this would call a Cloudflare Worker
      // to generate comprehensive fan analytics from streaming data
      
      // For now, we'll create a placeholder analytics entry
      const analytics: Partial<FanAnalytics> = {
        period: this.selectedPeriod(),
        totalListeners: 0,
        newListeners: 0,
        topTracks: [],
        topLocations: [],
        deviceBreakdown: [],
        peakListeningHours: [],
        generatedAt: new Date(),
      };

      const createResult = await this.dbService.create('fan_analytics', analytics as FanAnalytics);
      
      if (createResult.isSuccess()) {
        await this.loadAnalytics();
      } else {
        this.error.set(createResult.getError());
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to generate analytics');
    } finally {
      this.isGenerating.set(false);
    }
  }

  onPeriodChange(period: string): void {
    this.selectedPeriod.set(period);
    this.loadAnalytics();
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-ZA').format(num);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  clearError(): void {
    this.error.set(null);
  }
}
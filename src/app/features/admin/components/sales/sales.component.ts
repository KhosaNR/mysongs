import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../../../core/services/db.service';
import { ErrorHandler } from '../../../../core/utils/error-handler';

interface SalesReport {
  id: string;
  period: string;
  totalRevenue: number;
  totalSales: number;
  averageOrderValue: number;
  topSongs: { songId: string; title: string; sales: number }[];
  topArtists: { artistId: string; name: string; revenue: number }[];
  generatedAt: Date;
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss'
})
export class SalesComponent {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly salesReports = signal<SalesReport[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedPeriod = signal('7d');
  readonly isGenerating = signal(false);

  constructor() {
    this.loadSalesReports();
  }

  async loadSalesReports(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.getCollection<SalesReport>('sales_reports', {
      constraints: [],
    });

    this.isLoading.set(false);

    if (result.isSuccess()) {
      const reportsData = result.getData();
      this.salesReports.set(reportsData.map(doc => doc.data));
    } else {
      this.error.set(result.getError());
    }
  }

  async generateReport(): Promise<void> {
    this.isGenerating.set(true);
    this.error.set(null);

    try {
      // In a real implementation, this would call a Cloudflare Worker
      // to generate a comprehensive sales report from the purchases_ledger
      
      // For now, we'll create a simple report from purchases_ledger
      const purchasesResult = await this.dbService.getCollection<{
        purchaseType: string;
        amount: number;
        songId?: string;
        albumId?: string;
        userId: string;
        createdAt: Date;
      }>('purchases_ledger', {
        constraints: [],
      });

      if (purchasesResult.isSuccess()) {
        const purchases = purchasesResult.getData();
        const totalRevenue = purchases.reduce((sum, doc) => sum + (doc.data.amount || 0), 0);
        const totalSales = purchases.length;
        const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

        const report: Partial<SalesReport> = {
          period: this.selectedPeriod(),
          totalRevenue,
          totalSales,
          averageOrderValue,
          topSongs: [],
          topArtists: [],
          generatedAt: new Date(),
        };

        const createResult = await this.dbService.create('sales_reports', report as SalesReport);
        
        if (createResult.isSuccess()) {
          await this.loadSalesReports();
        } else {
          this.error.set(createResult.getError());
        }
      } else {
        this.error.set(purchasesResult.getError());
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      this.isGenerating.set(false);
    }
  }

  onPeriodChange(period: string): void {
    this.selectedPeriod.set(period);
    this.loadSalesReports();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount / 100);
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
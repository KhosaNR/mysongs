import { Injectable, inject } from '@angular/core';
import { ErrorHandler, Result } from '../utils/error-handler';
import { DbService } from './db.service';
import { ContentReport, ReportReason } from '../../shared/models/report.interface';

/**
 * Service handling content moderation reports against artists.
 *
 * Writes to the `reports` Firestore collection. Authenticated users can
 * submit reports; admins review and resolve them.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  /**
   * Submits a new report against an artist.
   *
   * @param reporterId - Public user ID of the reporting user
   * @param artistId - The artistId being reported
   * @param reason - Categorised reason for the report
   * @param details - Optional free-form details
   * @returns A Result indicating success or failure
   */
  async submitReport(
    reporterId: string,
    artistId: string,
    reason: ReportReason,
    details?: string
  ): Promise<Result<void>> {
    return this.errorHandler.execute(
      async () => {
        const report: Omit<ContentReport, 'id'> = {
          reporterId,
          artistId,
          reason,
          details,
          status: 'open',
          createdAt: new Date(),
        };
        await this.dbService.create('reports', report as ContentReport);
      },
      'submitReport',
      { artistId, reason, reporterId }
    );
  }

  /**
   * Fetches reports by moderation status.
   *
   * @param status - Filter by report status
   * @returns A Result containing an array of reports
   */
  async getReports(status?: 'open' | 'resolved' | 'dismissed'): Promise<Result<ContentReport[]>> {
    return this.errorHandler.execute(
      async () => {
        if (status) {
          const result = await this.dbService.getCollection<ContentReport>('reports', {
            constraints: [],
          });
          return result
            .getData()
            .map((doc) => ({ ...doc.data, id: doc.id }))
            .filter((report) => report.status === status);
        }
        const result = await this.dbService.getCollection<ContentReport>('reports', {
          constraints: [],
        });
        return result.getData().map((doc) => ({ ...doc.data, id: doc.id }));
      },
      'getReports',
      { status: status || 'all' }
    );
  }

  /**
   * Resolves a report (admin action).
   *
   * @param reportId - The report document id
   * @param adminUserId - Public user ID of the resolving admin
   * @param resolved - true to resolve, false to dismiss
   * @returns A Result indicating success or failure
   */
  async resolveReport(
    reportId: string,
    adminUserId: string,
    resolved: boolean
  ): Promise<Result<void>> {
    return this.errorHandler.execute(
      async () => {
        await this.dbService.update('reports', reportId, {
          status: resolved ? 'resolved' : 'dismissed',
          resolvedAt: new Date(),
          resolvedBy: adminUserId,
        } as Partial<ContentReport>);
      },
      'resolveReport',
      { reportId, resolved }
    );
  }
}
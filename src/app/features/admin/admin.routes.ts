import { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'artists',
        loadComponent: () =>
          import('./components/artist-management/artist-management.component').then(
            (m) => m.ArtistManagementComponent,
          ),
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./components/artist-approvals/artist-approvals.component').then(
            (m) => m.ArtistApprovalsComponent,
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./components/moderation/reports.component').then(
            (m) => m.ReportsComponent,
          ),
      },
      {
        path: 'tracks',
        loadComponent: () =>
          import('./components/track-management/track-management.component').then(
            (m) => m.TrackManagementComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./components/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent,
          ),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./components/sales/sales.component').then(
            (m) => m.SalesComponent,
          ),
      },
      {
        path: 'sponsors',
        loadComponent: () =>
          import('./components/sponsor-management/sponsor-management.component').then(
            (m) => m.SponsorManagementComponent,
          ),
      },
      {
        path: 'annotations',
        loadComponent: () =>
          import('./components/annotations/annotations.component').then(
            (m) => m.AnnotationsComponent,
          ),
      },
      {
        path: 'fan-analytics',
        loadComponent: () =>
          import('./components/fan-analytics/fan-analytics.component').then(
            (m) => m.FanAnalyticsComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./components/site-settings/site-settings.component').then(
            (m) => m.SiteSettingsComponent,
          ),
      },
    ],
  },
];
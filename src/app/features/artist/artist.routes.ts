import { Routes } from '@angular/router';
import { ArtistLayoutComponent } from './artist-layout.component';

export const artistRoutes: Routes = [
  {
    path: '',
    component: ArtistLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
      {
        // Legacy route — the artist dashboard was renamed to Analytics.
        path: 'dashboard',
        redirectTo: 'analytics',
        pathMatch: 'full',
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./artist-dashboard.component').then(
            (m) => m.ArtistDashboardComponent,
          ),
      },
      {
        // The artist management hub — the reused public artist screen in self mode,
        // showing the logged-in artist's profile and editable catalog tabs.
        path: 'profile',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'albums' },
      },
      {
        path: 'albums',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'albums' },
      },
      {
        path: 'songs',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'songs' },
      },
      {
        path: 'singles',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'singles' },
      },
      {
        path: 'videos',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'videos' },
      },
      {
        path: 'lyrics',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'lyrics' },
      },
      {
        path: 'collections',
        loadComponent: () =>
          import('../artist-detail/artist-detail.component').then(
            (m) => m.ArtistDetailComponent,
          ),
        data: { tab: 'collections' },
      },
      {
        // Legacy route — redirect old /tracks to /songs
        path: 'tracks',
        redirectTo: 'songs',
        pathMatch: 'full',
      },
      {
        path: 'sponsors',
        loadComponent: () =>
          import('./sponsor-management/sponsor-management.component').then(
            (m) => m.SponsorManagementComponent,
          ),
      },
      {
        path: 'annotations',
        loadComponent: () =>
          import('./annotation-management/annotation-management.component').then(
            (m) => m.AnnotationManagementComponent,
          ),
      },
    ],
  },
];
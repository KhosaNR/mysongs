import { Routes } from '@angular/router';
import { ErrorPageComponent } from '../../shared/components/error-page/error-page.component';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import { ExploreComponent } from '../../features/explore/explore.component';
import { HomeRedirectComponent } from '../../shared/components/home-redirect/home-redirect.component';
import { guestGuard, authenticatedGuard, authGuard, artistGuard, grantedRoleGuard } from '../guards/auth.guard';
import { adminRoutes } from '../../features/admin/admin.routes';
import { artistRoutes } from '../../features/artist/artist.routes';
import { USER_ROLE } from '../constants/navigation.constants';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeRedirectComponent,
  },
  {
    path: 'explore',
    component: ExploreComponent,
  },
  {
    path: 'error',
    component: ErrorPageComponent,
  },
  {
    path: '404',
    component: NotFoundComponent,
  },
  {
    path: 'search',
    loadComponent: () =>
      import('../../features/search/search.component').then(
        (m) => m.SearchPageComponent,
      ),
  },
  {
    path: 'album/:albumId',
    loadComponent: () =>
      import('../../features/album-detail/album-detail.component').then(
        (m) => m.AlbumDetailComponent,
      ),
  },
  {
    path: 'song/:songId',
    loadComponent: () =>
      import('../../features/song-detail/song-detail.component').then(
        (m) => m.SongDetailComponent,
      ),
  },
  {
    path: 'playlists',
    loadComponent: () =>
      import('../../features/playlists/playlists.component').then(
        (m) => m.PlaylistsComponent,
      ),
    canActivate: [grantedRoleGuard],
  },
  {
    path: 'playlist/:playlistId',
    loadComponent: () =>
      import('../../features/playlists/playlist-detail.component').then(
        (m) => m.PlaylistDetailComponent,
      ),
  },
  {
    path: 'collection/:collectionId',
    loadComponent: () =>
      import('../../features/collections/collection-detail.component').then(
        (m) => m.CollectionDetailComponent,
      ),
  },
  {
    path: 'legal',
    children: [
      {
        path: 'privacy',
        loadComponent: () =>
          import('../../features/legal/privacy-policy.component').then(
            (m) => m.PrivacyPolicyComponent,
          ),
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('../../features/legal/terms-of-service.component').then(
            (m) => m.TermsOfServiceComponent,
          ),
      },
      {
        path: 'cookies',
        loadComponent: () =>
          import('../../features/legal/cookie-policy.component').then(
            (m) => m.CookiePolicyComponent,
          ),
      },
    ],
  },
  // Auth routes
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('../../features/auth/login/login.component').then(
            (m) => m.LoginComponent,
          ),
        canActivate: [guestGuard],
      },
      {
        path: 'sign-up',
        loadComponent: () =>
          import('../../features/auth/register/register.component').then(
            (m) => m.RegisterComponent,
          ),
        canActivate: [guestGuard],
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('../../features/auth/password-reset/password-reset.component').then(
            (m) => m.PasswordResetComponent,
          ),
      },
      {
        path: 'verify-email',
        loadComponent: () =>
          import('../../features/auth/verify-email/verify-email.component').then(
            (m) => m.VerifyEmailComponent,
          ),
        canActivate: [authenticatedGuard],
      },
    ],
  },
  // Protected routes
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../../features/auth/listener-dashboard/listener-dashboard.component').then(
        (m) => m.ListenerDashboardComponent,
      ),
    canActivate: [grantedRoleGuard],
  },
  {
    path: 'account',
    loadComponent: () =>
      import('../../features/auth/account-settings/account-settings.component').then(
        (m) => m.AccountSettingsComponent,
      ),
    canActivate: [authenticatedGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('../../features/onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent,
      ),
    canActivate: [authenticatedGuard],
  },
  // Artist routes (layout: analytics + the artist management hub). Registered BEFORE the public
  // `artist/:artistId` detail route so static children like `/artist/albums` win over the param
  // route; any other `:artistId` value falls through to the public artist page below.
  {
    path: 'artist',
    children: artistRoutes,
    canActivate: [artistGuard],
  },
  {
    path: 'artist/:artistId',
    loadComponent: () =>
      import('../../features/artist-detail/artist-detail.component').then(
        (m) => m.ArtistDetailComponent,
      ),
  },
  {
    path: 'artist-pending',
    loadComponent: () =>
      import('../../features/artist/artist-pending.component').then(
        (m) => m.ArtistPendingComponent,
      ),
    canActivate: [authenticatedGuard],
  },
  // Admin routes
  {
    path: 'admin',
    children: adminRoutes,
    canActivate: [authGuard],
    data: { roles: [USER_ROLE.ADMIN] },
  },
  {
    path: '**',
    redirectTo: '/404',
  },
];
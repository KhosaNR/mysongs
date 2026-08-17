import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole, ROUTE, ROLE_LANDING } from '../constants/navigation.constants';

/**
 * Returns the role-based landing page for an authenticated user.
 *
 * @param role - The user's role
 * @returns The landing page path
 */
function getRoleLanding(role: UserRole): string {
  return ROLE_LANDING[role];
}

/**
 * Route guard that enforces authentication and role-based access control.
 *
 * Protects routes based on authentication status and user roles.
 * Supports multiple role requirements and redirects unauthenticated users.
 *
 * @example
 * // In core/routes/app.routes.ts
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [authGuard],
 *   data: { roles: ['admin'] }
 * }
 */
export const authGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  // Get required roles from route data
  const requiredRoles = route.data['roles'] as UserRole[] | undefined;

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    // Redirect to login with return URL
    return router.createUrlTree([ROUTE.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }

  // If no specific roles required, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Check if user has one of the required roles
  const hasRequiredRole = requiredRoles.some(role => {
    try {
      return authService.hasRole(role);
    } catch {
      // If hasRole throws, user is not authenticated (shouldn't happen here)
      return false;
    }
  });

  if (hasRequiredRole) {
    return true;
  }

  // User doesn't have required role - redirect to their role landing
  const user = authService.currentUser();
  if (user) {
    return router.createUrlTree([getRoleLanding(user.role)]);
  }

  return router.createUrlTree([ROUTE.UNAUTHORIZED]);
};

/**
 * Guard that allows only authenticated users (any role).
 *
 * @example
 * {
 *   path: 'profile',
 *   component: ProfileComponent,
 *   canActivate: [authenticatedGuard]
 * }
 */
export const authenticatedGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([ROUTE.LOGIN], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Guard that allows only guest users (not authenticated).
 * Redirects authenticated users to their role-based landing page.
 *
 * @example
 * {
 *   path: 'login',
 *   component: LoginComponent,
 *   canActivate: [guestGuard]
 * }
 */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Redirect authenticated users to their role-based landing
  const user = authService.currentUser();
  if (user) {
    return router.createUrlTree([getRoleLanding(user.role)]);
  }

  return router.createUrlTree([ROUTE.EXPLORE]);
};

/**
 * Guard for public landing pages that redirects admins/artists to their
 * dashboards once auth state resolves.
 *
 * Prevents an artist/admin from lingering on a public page (e.g. explore)
 * after Firebase restores their session on app start or direct navigation.
 *
 * @example
 * {
 *   path: 'explore',
 *   component: ExploreComponent,
 *   canActivate: [dashboardRedirectGuard]
 * }
 */
export const dashboardRedirectGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  const user = authService.currentUser();
  if (user?.role === 'admin' || user?.role === 'artist') {
    return router.createUrlTree([getRoleLanding(user.role)]);
  }

  return true;
};

/**
 * Guard that allows only admin users.
 *
 * @example
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [adminGuard]
 * }
 */
export const adminGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree([ROUTE.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.isAdmin()) {
    return true;
  }

  return router.createUrlTree([ROUTE.UNAUTHORIZED]);
};

/**
 * Guard that allows only approved artist users.
 * Checks both role='artist' and artistStatus='approved'.
 *
 * @example
 * {
 *   path: 'artist/analytics',
 *   component: ArtistDashboardComponent,
 *   canActivate: [artistGuard]
 * }
 */
export const artistGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree([ROUTE.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }

  // Check if user has artist role AND is approved
  if (authService.isArtist() && authService.currentUser()?.artistStatus === 'approved') {
    return true;
  }

  // Redirect to pending approval page or unauthorized
  return router.createUrlTree(['/artist-pending']);
};

/**
 * Guard that allows only listener users.
 *
 * @example
 * {
 *   path: 'listener/dashboard',
 *   component: ListenerDashboardComponent,
 *   canActivate: [listenerGuard]
 * }
 */
export const listenerGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree([ROUTE.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.isListener()) {
    return true;
  }

  return router.createUrlTree([ROUTE.UNAUTHORIZED]);
};

/**
 * Guard that allows only authenticated users with a granted role (listener,
 * artist, or admin). Excludes visitors — authenticated sessions with no
 * granted role — from listener-only screens while preserving access for
 * every existing account type (including pending artists).
 *
 * @example
 * {
 *   path: 'playlists',
 *   component: PlaylistsComponent,
 *   canActivate: [grantedRoleGuard]
 * }
 */
export const grantedRoleGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for Firebase to restore the persisted auth session before deciding.
  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree([ROUTE.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.hasGrantedRole()) {
    return true;
  }

  // Visitor (authenticated with no granted role) — back to public explore.
  return router.createUrlTree([ROUTE.EXPLORE]);
};
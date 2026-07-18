import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';

/**
 * Route guard that enforces authentication and role-based access control.
 * 
 * Protects routes based on authentication status and user roles.
 * Supports multiple role requirements and redirects unauthenticated users.
 * 
 * @example
 * // In app.routes.ts
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [authGuard],
 *   data: { roles: ['admin'] }
 * }
 * 
 * // Allow any authenticated user
 * {
 *   path: 'dashboard',
 *   component: DashboardComponent,
 *   canActivate: [authGuard]
 * }
 * 
 * // Allow multiple roles
 * {
 *   path: 'manage',
 *   component: ManageComponent,
 *   canActivate: [authGuard],
 *   data: { roles: ['admin', 'artist'] }
 * }
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Get required roles from route data
  const requiredRoles = route.data['roles'] as UserRole[] | undefined;

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    // Redirect to login with return URL
    return router.createUrlTree(['/login'], {
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

  // User doesn't have required role - redirect to unauthorized page
  return router.createUrlTree(['/unauthorized']);
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
export const authenticatedGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Guard that allows only guest users (not authenticated).
 * Redirects authenticated users to the home page.
 * 
 * @example
 * {
 *   path: 'login',
 *   component: LoginComponent,
 *   canActivate: [guestGuard]
 * }
 */
export const guestGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Redirect authenticated users to home or return URL
  const returnUrl = route.queryParams['returnUrl'] || '/';
  return router.createUrlTree([returnUrl]);
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
export const adminGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};

/**
 * Guard that allows only artist users.
 * 
 * @example
 * {
 *   path: 'artist/dashboard',
 *   component: ArtistDashboardComponent,
 *   canActivate: [artistGuard]
 * }
 */
export const artistGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.isArtist()) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
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
export const listenerGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (authService.isListener()) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
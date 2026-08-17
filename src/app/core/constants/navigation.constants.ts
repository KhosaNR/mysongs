/**
 * Application navigation constants.
 *
 * Centralizes role identifiers, route paths, and role-based landing pages
 * to prevent hardcoded string mistakes across the codebase.
 */

/**
 * Supported user role identifiers.
 *
 * `visitor` is the derived fallback for authenticated sessions with no
 * granted role (no elevated custom-claim role and no role on the user
 * document). New registrations are always granted either `listener` or
 * `artist`; `visitor` is never persisted as a new-account role.
 */
export const USER_ROLE = {
  ADMIN: 'admin',
  ARTIST: 'artist',
  LISTENER: 'listener',
  VISITOR: 'visitor',
} as const;

/**
 * Union type of all supported user roles.
 */
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/**
 * Core application route paths.
 */
export const ROUTE = {
  EXPLORE: '/explore',
  SEARCH: '/search',
  LOGIN: '/auth/login',
  SIGN_UP: '/auth/sign-up',
  ADMIN: '/admin',
  ARTIST: '/artist',
  DASHBOARD: '/dashboard',
  ACCOUNT: '/account',
  PLAYLISTS: '/playlists',
  UNAUTHORIZED: '/unauthorized',
} as const;

/**
 * Role-based landing page for each user role.
 */
export const ROLE_LANDING: Record<UserRole, string> = {
  [USER_ROLE.ADMIN]: ROUTE.ADMIN,
  [USER_ROLE.ARTIST]: ROUTE.ARTIST,
  [USER_ROLE.LISTENER]: ROUTE.EXPLORE,
  [USER_ROLE.VISITOR]: ROUTE.EXPLORE,
};
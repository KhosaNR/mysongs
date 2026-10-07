/**
 * Shared Firebase Auth error catalog.
 *
 * Single source of truth for consumer-facing authentication messages.
 * Both `ErrorHandler` (service `Result` failures) and the HTTP
 * `ErrorInterceptor` delegate here so the two maps cannot drift.
 *
 * Security note: login failures use one combined message that never reveals
 * whether the email exists (`auth/invalid-credential` is Firebase's combined
 * wrong-email/wrong-password code). Password-reset flows must additionally
 * avoid enumeration — see `PASSWORD_RESET_*` below.
 *
 * @example
 * ```typescript
 * import { getAuthErrorMessage } from '../utils/auth-error-messages';
 *
 * const friendly = getAuthErrorMessage('auth/invalid-credential');
 * // 'Email or password is incorrect. Please try again.'
 * ```
 */

/**
 * Combined login failure message. Deliberately does not distinguish between
 * an unknown email and a wrong password to prevent account enumeration.
 */
export const INVALID_CREDENTIALS_MESSAGE =
  'Email or password is incorrect. Please try again.';

/**
 * Generic password-reset confirmation. Shown for both real success and
 * enumeration-masked "user not found" so observers cannot probe which
 * emails are registered.
 */
export const PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE =
  'If an account exists for that email, a reset link has been sent. Please check your inbox and spam folder.';

/**
 * Firebase Auth codes that mean "no account for these credentials".
 * Callers handling password reset treat these as a silent success
 * (see `isPasswordResetEnumerationCode`).
 */
export const PASSWORD_RESET_ENUMERATION_CODES: ReadonlySet<string> = new Set([
  'auth/user-not-found',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

/**
 * Consumer-facing message per Firebase Auth error code.
 */
const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'auth/invalid-credential': INVALID_CREDENTIALS_MESSAGE,
  'auth/invalid-login-credentials': INVALID_CREDENTIALS_MESSAGE,
  'auth/user-not-found': INVALID_CREDENTIALS_MESSAGE,
  'auth/wrong-password': INVALID_CREDENTIALS_MESSAGE,
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/operation-not-allowed':
    'Email/password sign-in is currently unavailable. Please try again later.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use':
    'This email is already registered. Try signing in instead.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/network-request-failed':
    'Network error. Please check your connection and try again.',
  'auth/popup-closed-by-user':
    'Google sign-in was closed before finishing. Please try again.',
  'auth/cancelled-popup-request': 'Google sign-in was interrupted. Please try again.',
  'auth/popup-blocked':
    'Your browser blocked the Google sign-in pop-up. Please allow pop-ups and try again.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with a different sign-in method. Try signing in with email and password.',
  'auth/requires-recent-login':
    'For your security, please sign in again and try that action once more.',
  'auth/expired-action-code':
    'This reset link is invalid or has expired. Please request a new one.',
  'auth/invalid-action-code':
    'This reset link is invalid or has expired. Please request a new one.',
};

/**
 * Looks up the consumer-facing message for a Firebase Auth error code.
 *
 * @param errorCode - Raw error code (e.g. `auth/invalid-credential`)
 * @returns The friendly message, or `undefined` when the code is not an Auth code
 */
export function getAuthErrorMessage(errorCode: string): string | undefined {
  return AUTH_ERROR_MESSAGES[errorCode];
}

/**
 * Checks whether a Firebase Auth code is a password-reset enumeration case
 * that must be surfaced as a generic success instead of an error.
 *
 * @param errorCode - Raw error code from the caught error
 * @returns true when the reset flow should report success text
 */
export function isPasswordResetEnumerationCode(errorCode: string): boolean {
  return PASSWORD_RESET_ENUMERATION_CODES.has(errorCode);
}

/**
 * Checks whether a surfaced message is the reset enumeration mask, for
 * callers that only have the mapped friendly string (the centralized
 * `ErrorHandler` converts codes to messages before returning `Result`).
 *
 * @param message - Consumer-facing error message from a failed `Result`
 * @returns true when the message is the masked invalid-credentials text
 */
export function isPasswordResetEnumerationMessage(message: string): boolean {
  return message === INVALID_CREDENTIALS_MESSAGE;
}

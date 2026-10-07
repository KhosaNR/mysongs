/**
 * Regression tests for the shared Firebase Auth error catalog.
 *
 * Login must surface `Email or password is incorrect` for every credential
 * failure (notably `auth/invalid-credential`, Firebase's combined
 * wrong-email/wrong-password code) instead of the generic unexpected-error
 * fallback. Password-reset enumeration codes must resolve to the masked
 * generic success text.
 */
import {
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE,
  getAuthErrorMessage,
  isPasswordResetEnumerationCode,
} from './auth-error-messages';

describe('getAuthErrorMessage', () => {
  it('should map the combined invalid-credential code to the login message', () => {
    expect(getAuthErrorMessage('auth/invalid-credential')).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it('should use the same combined message for legacy credential codes', () => {
    expect(getAuthErrorMessage('auth/invalid-login-credentials')).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(getAuthErrorMessage('auth/user-not-found')).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(getAuthErrorMessage('auth/wrong-password')).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it('should explain disabled accounts and rate limiting', () => {
    expect(getAuthErrorMessage('auth/user-disabled')).toContain('disabled');
    expect(getAuthErrorMessage('auth/too-many-requests')).toContain('Too many attempts');
  });

  it('should guide existing-email and Google pop-up failures', () => {
    expect(getAuthErrorMessage('auth/email-already-in-use')).toContain('already registered');
    expect(getAuthErrorMessage('auth/popup-closed-by-user')).toContain('Google sign-in');
    expect(getAuthErrorMessage('auth/popup-blocked')).toContain('pop-up');
    expect(getAuthErrorMessage('auth/account-exists-with-different-credential')).toContain(
      'different sign-in method'
    );
  });

  it('should return undefined for non-auth codes so callers keep their fallback', () => {
    expect(getAuthErrorMessage('permission-denied')).toBeUndefined();
    expect(getAuthErrorMessage('UNKNOWN')).toBeUndefined();
  });
});

describe('password-reset enumeration protection', () => {
  it('should flag unknown-account codes for silent success', () => {
    expect(isPasswordResetEnumerationCode('auth/user-not-found')).toBe(true);
    expect(isPasswordResetEnumerationCode('auth/invalid-credential')).toBe(true);
    expect(isPasswordResetEnumerationCode('auth/invalid-login-credentials')).toBe(true);
  });

  it('should not mask real failures such as network or throttling', () => {
    expect(isPasswordResetEnumerationCode('auth/network-request-failed')).toBe(false);
    expect(isPasswordResetEnumerationCode('auth/too-many-requests')).toBe(false);
    expect(isPasswordResetEnumerationCode('auth/invalid-email')).toBe(false);
  });

  it('should use the approved generic reset confirmation text', () => {
    expect(PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE).toContain('reset link has been sent');
    expect(PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE).toContain('inbox and spam folder');
  });
});

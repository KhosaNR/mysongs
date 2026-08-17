/**
 * Cookie consent banner component with POPIA-compliant opt-in.
 *
 * Displays a fixed-bottom banner on first visit and stores consent
 * in localStorage. Once accepted, the banner is permanently hidden.
 *
 * @example
 * ```html
 * <app-cookie-consent />
 * ```
 */

import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

const STORAGE_KEY = 'cookie-consent';

/**
 * Cookie consent banner with POPIA-compliant opt-in model.
 *
 * Features:
 * - Fixed-bottom banner with slide-up entrance animation
 * - Implicit consent model: "Accept" button records consent
 * - Links to Cookie Policy and Privacy Policy
 * - Persists consent to localStorage to prevent re-display
 * - Accessible with role="dialog" and proper aria labels
 */
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isDismissed()) {
      <div
        class="cookie-consent"
        role="dialog"
        aria-label="Cookie consent"
        aria-describedby="cookie-consent-message"
        [class.cookie-consent--visible]="!isDismissed()"
      >
        <div class="cookie-consent__content">
          <p id="cookie-consent-message" class="cookie-consent__message">
            We use cookies to enhance your experience. By continuing to browse,
            you agree to our
            <a routerLink="/legal/cookies" class="cookie-consent__link">Cookie Policy</a>
            and
            <a routerLink="/legal/privacy" class="cookie-consent__link">Privacy Policy</a>.
          </p>

          <div class="cookie-consent__actions">
            <button
              type="button"
              class="cookie-consent__btn cookie-consent__btn--primary"
              (click)="accept()"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cookie-consent {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: var(--z-overlay, 1000);
      background: var(--bg-primary);
      border-top: 1px solid var(--border-color);
      padding: var(--space-4) var(--space-6);
      transform: translateY(100%);
      transition: transform var(--transition-base) var(--ease-out);
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    }

    .cookie-consent--visible {
      transform: translateY(0);
    }

    .cookie-consent__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      max-width: 960px;
      margin: 0 auto;
      flex-wrap: wrap;
    }

    .cookie-consent__message {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: var(--leading-relaxed);
      flex: 1;
      min-width: 240px;
    }

    .cookie-consent__link {
      color: var(--accent-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .cookie-consent__link:hover {
      opacity: 0.8;
    }

    .cookie-consent__actions {
      display: flex;
      gap: var(--space-3);
      flex-shrink: 0;
    }

    .cookie-consent__btn {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      border: none;
      line-height: var(--leading-normal);
      white-space: nowrap;
    }

    .cookie-consent__btn--primary {
      background: var(--accent-primary);
      color: var(--text-on-primary);
    }

    .cookie-consent__btn--primary:hover {
      opacity: 0.9;
    }

    @media (max-width: 640px) {
      .cookie-consent {
        padding: var(--space-3) var(--space-4);
      }

      .cookie-consent__content {
        flex-direction: column;
        align-items: flex-start;
      }

      .cookie-consent__actions {
        width: 100%;
      }

      .cookie-consent__btn {
        width: 100%;
        text-align: center;
      }
    }
  `],
})
export class CookieConsentComponent {
  // ==========================================================================
  // INTERNAL STATE
  // ==========================================================================

  /**
   * Whether the consent banner has been dismissed.
   * Initialized by checking localStorage.
   */
  protected readonly isDismissed = signal<boolean>(this.hasConsent());

  // ==========================================================================
  // METHODS
  // ==========================================================================

  /**
   * Check if the user has already given consent.
   */
  private hasConsent(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'accepted';
    } catch {
      // localStorage may not be available (SSR, privacy mode)
      return false;
    }
  }

  /**
   * Accept cookies and store consent in localStorage.
   */
  protected accept(): void {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // Silently fail if localStorage is unavailable
    }
    this.isDismissed.set(true);
  }
}
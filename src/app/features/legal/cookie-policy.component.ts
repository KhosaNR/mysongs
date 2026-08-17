/**
 * Cookie Policy page component.
 *
 * Displays information about cookies used on the platform,
 * their purpose, duration, and how users can manage preferences.
 *
 * @example
 * ```html
 * <app-cookie-policy />
 * ```
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Cookie Policy page with POPIA-compliant disclosures.
 *
 * Covers:
 * - Types of cookies used (Firebase Auth, theme preferences, analytics)
 * - Purpose and duration of each cookie
 * - Third-party cookie usage
 * - Opt-in/opt-out instructions
 * - Link to cookie consent settings
 */
@Component({
  selector: 'app-cookie-policy',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legal-page">
      <div class="legal-page__container">
        <nav class="legal-page__nav">
          <a routerLink="/" class="legal-page__back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Home
          </a>
        </nav>

        <h1 class="legal-page__title">Cookie Policy</h1>
        <p class="legal-page__updated">Last updated: July 2026</p>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">1. What Are Cookies</h2>
          <p class="legal-page__text">
            Cookies are small text files stored on your device by your web browser when you visit a website. 
            They help websites remember your preferences and improve your browsing experience.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">2. Cookies We Use</h2>
          <p class="legal-page__text">
            We use the following types of cookies on our platform:
          </p>

          <div class="legal-page__table-wrapper">
            <table class="legal-page__table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Firebase Auth Session</td>
                  <td>Maintains your authenticated session</td>
                  <td>Session / Persistent</td>
                  <td>Essential</td>
                </tr>
                <tr>
                  <td>Theme Preference</td>
                  <td>Remembers your dark/light mode selection</td>
                  <td>1 year</td>
                  <td>Functional</td>
                </tr>
                <tr>
                  <td>Cookie Consent</td>
                  <td>Records your cookie consent preference</td>
                  <td>1 year</td>
                  <td>Functional</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">3. Third-Party Cookies</h2>
          <p class="legal-page__text">
            We may use third-party services that set their own cookies:
          </p>
          <ul class="legal-page__list">
            <li><strong>Firebase (Google):</strong> Uses cookies for authentication session management and security.</li>
            <li><strong>Cloudflare:</strong> Uses cookies for security and performance optimization.</li>
            <li><strong>Yoco:</strong> Uses cookies for payment processing (only during checkout).</li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">4. Managing Cookies</h2>
          <p class="legal-page__text">
            You can control and manage cookies in several ways:
          </p>
          <ul class="legal-page__list">
            <li><strong>Browser settings:</strong> Most browsers allow you to view, block, or delete cookies through their settings.</li>
            <li><strong>Cookie consent banner:</strong> When you first visit our site, you can accept or decline non-essential cookies.</li>
            <li><strong>Clearing cookies:</strong> You can clear stored cookies at any time through your browser preferences.</li>
          </ul>
          <p class="legal-page__text">
            Please note that blocking essential cookies may affect the functionality of our platform, 
            particularly authentication and session management features.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">5. POPIA Compliance</h2>
          <p class="legal-page__text">
            In accordance with the Protection of Personal Information Act (POPIA), we follow an 
            <strong>implicit consent model</strong> for cookies. By continuing to browse our website, 
            you consent to the use of cookies as described in this policy. You may withdraw your 
            consent at any time by clearing your cookies through your browser settings.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">6. Updates to This Policy</h2>
          <p class="legal-page__text">
            We may update this Cookie Policy from time to time. Changes will be posted on this page 
            with an updated "Last updated" date. We encourage you to review this policy periodically.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">7. Contact</h2>
          <p class="legal-page__text">
            If you have questions about our use of cookies, please contact us at:<br>
            <strong>Email:</strong> privacy&#64;mysongs.com
          </p>
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .legal-page {
      padding: var(--space-8) var(--space-6);
      max-width: 720px;
      margin: 0 auto;
    }

    .legal-page__container {
      animation: legal-fade-in var(--transition-base) var(--ease-out);
    }

    @keyframes legal-fade-in {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .legal-page__nav {
      margin-bottom: var(--space-6);
    }

    .legal-page__back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      text-decoration: none;
      transition: color var(--transition-fast);
    }

    .legal-page__back svg {
      width: 16px;
      height: 16px;
    }

    .legal-page__back:hover {
      color: var(--accent-primary);
    }

    .legal-page__title {
      font-size: var(--text-3xl);
      font-weight: var(--weight-normal);
      color: var(--text-heading);
      margin: 0 0 var(--space-2);
      line-height: var(--leading-tight);
    }

    .legal-page__updated {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      margin: 0 0 var(--space-8);
    }

    .legal-page__section {
      margin-bottom: var(--space-8);
    }

    .legal-page__heading {
      font-size: var(--text-xl);
      font-weight: var(--weight-normal);
      color: var(--text-heading);
      margin: 0 0 var(--space-3);
      line-height: var(--leading-tight);
    }

    .legal-page__text {
      font-size: var(--text-base);
      color: var(--text-secondary);
      line-height: var(--leading-relaxed);
      margin: 0 0 var(--space-3);
    }

    .legal-page__list {
      margin: 0 0 var(--space-3);
      padding-left: var(--space-5);
    }

    .legal-page__list li {
      margin-bottom: var(--space-2);
      font-size: var(--text-base);
      color: var(--text-secondary);
      line-height: var(--leading-relaxed);
    }

    .legal-page__table-wrapper {
      overflow-x: auto;
      margin-bottom: var(--space-3);
    }

    .legal-page__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
    }

    .legal-page__table th,
    .legal-page__table td {
      padding: var(--space-2) var(--space-3);
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .legal-page__table th {
      font-weight: 700;
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }

    .legal-page__table td {
      color: var(--text-secondary);
    }
  `],
})
export class CookiePolicyComponent {}
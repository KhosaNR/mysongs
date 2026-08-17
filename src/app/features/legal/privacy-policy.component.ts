/**
 * Privacy Policy page component.
 *
 * Displays the POPIA-compliant privacy policy covering
 * data collection, usage, rights, and contact information.
 *
 * @example
 * ```html
 * <app-privacy-policy />
 * ```
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Privacy Policy page with POPIA-compliant disclosures.
 *
 * Covers:
 * - Information collected (email, name, payment info)
 * - Purpose of data collection (marketing, purchases)
 * - POPIA user rights (access, correction, deletion)
 * - Third-party sharing disclosures
 * - Data retention policy
 * - Cookie usage
 * - Contact information
 */
@Component({
  selector: 'app-privacy-policy',
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

        <h1 class="legal-page__title">Privacy Policy</h1>
        <p class="legal-page__updated">Last updated: July 2026</p>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">1. Information We Collect</h2>
          <p class="legal-page__text">
            When you use our service, we may collect the following information:
          </p>
          <ul class="legal-page__list">
            <li><strong>Account information:</strong> Your name, email address, and profile picture when you register or sign in.</li>
            <li><strong>Payment information:</strong> When you make a purchase, payment processing is handled securely by Yoco. We do not store full credit card numbers.</li>
            <li><strong>Usage data:</strong> Information about how you interact with our platform, including tracks you stream, search queries, and pages you visit.</li>
            <li><strong>Device information:</strong> Browser type, operating system, and device type for analytics and performance optimization.</li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">2. How We Use Your Information</h2>
          <p class="legal-page__text">
            We use the collected information for the following purposes:
          </p>
          <ul class="legal-page__list">
            <li>To provide and maintain our music streaming and download service</li>
            <li>To process your purchases and deliver digital downloads</li>
            <li>To send you marketing communications if you have explicitly opted in</li>
            <li>To improve our platform and personalize your experience</li>
            <li>To comply with legal obligations and enforce our Terms of Service</li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">3. Your POPIA Rights</h2>
          <p class="legal-page__text">
            Under the Protection of Personal Information Act (POPIA), you have the following rights:
          </p>
          <ul class="legal-page__list">
            <li><strong>Right to access:</strong> You may request a copy of the personal data we hold about you.</li>
            <li><strong>Right to correction:</strong> You may request that we correct any inaccurate or incomplete data.</li>
            <li><strong>Right to deletion:</strong> You may request deletion of your account and associated data at any time.</li>
            <li><strong>Right to object:</strong> You may object to the processing of your personal data for marketing purposes.</li>
            <li><strong>Right to data portability:</strong> You may request a copy of your data in a structured, machine-readable format.</li>
          </ul>
          <p class="legal-page__text">
            To exercise any of these rights, please contact us using the details below.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">4. Third-Party Services</h2>
          <p class="legal-page__text">
            We use the following third-party services that may process your data:
          </p>
          <ul class="legal-page__list">
            <li><strong>Firebase (Google):</strong> Authentication and database services. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener" class="legal-page__link">Privacy Policy</a></li>
            <li><strong>Cloudflare:</strong> Hosting, CDN, and edge computing services. <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener" class="legal-page__link">Privacy Policy</a></li>
            <li><strong>Yoco:</strong> Payment processing for purchases. <a href="https://www.yoco.com/za/privacy-policy" target="_blank" rel="noopener" class="legal-page__link">Privacy Policy</a></li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">5. Data Retention</h2>
          <p class="legal-page__text">
            We retain your personal data for as long as your account is active or as needed to provide our services. 
            If you delete your account, we will delete or anonymize your personal data within 30 days, 
            except where retention is required by law (e.g., purchase records for tax purposes).
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">6. Cookies</h2>
          <p class="legal-page__text">
            We use cookies and similar tracking technologies to enhance your experience. 
            Please see our <a routerLink="/legal/cookies" class="legal-page__link">Cookie Policy</a> for more information.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">7. Contact Us</h2>
          <p class="legal-page__text">
            If you have any questions about this Privacy Policy or wish to exercise your POPIA rights, 
            please contact us at:
          </p>
          <p class="legal-page__text">
            <strong>Email:</strong> privacy&#64;mysongs.com<br>
            <strong>Address:</strong> Johannesburg, South Africa
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

    .legal-page__link {
      color: var(--accent-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .legal-page__link:hover {
      opacity: 0.8;
    }
  `],
})
export class PrivacyPolicyComponent {}
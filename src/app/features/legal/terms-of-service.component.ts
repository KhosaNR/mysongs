/**
 * Terms of Service page component.
 *
 * Displays the terms governing use of the platform,
 * covering account terms, purchases, licenses, and legal terms.
 *
 * @example
 * ```html
 * <app-terms-of-service />
 * ```
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Terms of Service page with legal disclosures.
 *
 * Covers:
 * - Account registration and responsibilities
 * - Purchase terms (per-track digital downloads, priced at checkout)
 * - License grant (non-transferable)
 * - Prohibited uses
 * - Limitation of liability
 * - Governing law (South Africa)
 * - Modifications to terms
 */
@Component({
  selector: 'app-terms-of-service',
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

        <h1 class="legal-page__title">Terms of Service</h1>
        <p class="legal-page__updated">Last updated: July 2026</p>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">1. Acceptance of Terms</h2>
          <p class="legal-page__text">
            By accessing or using this website, you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use our service.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">2. Account Registration</h2>
          <p class="legal-page__text">
            To purchase downloads or access certain features, you must create an account. You are responsible for:
          </p>
          <ul class="legal-page__list">
            <li>Providing accurate and complete registration information</li>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use of your account</li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">3. Purchases & Payments</h2>
          <p class="legal-page__text">
            Digital music downloads are priced per track as displayed at checkout (including VAT).
            All payments are processed securely through <strong>Yoco</strong>. By making a purchase, you agree to:
          </p>
          <ul class="legal-page__list">
            <li>Provide valid payment information</li>
            <li>Pay all charges at the prices displayed at the time of purchase</li>
            <li>Accept that digital downloads are non-refundable once delivered</li>
            <li>Comply with any additional terms presented during the checkout process</li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">4. License Grant</h2>
          <p class="legal-page__text">
            When you purchase a track, you receive a <strong>non-exclusive, non-transferable</strong> license to:
          </p>
          <ul class="legal-page__list">
            <li>Download and store the track for personal, non-commercial use</li>
            <li>Stream the track through our platform</li>
          </ul>
          <p class="legal-page__text">
            You may not redistribute, sell, publicly perform, or use the tracks for commercial purposes without explicit written permission.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">5. Prohibited Uses</h2>
          <p class="legal-page__text">You agree not to:</p>
          <ul class="legal-page__list">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to circumvent our security measures or rate limits</li>
            <li>Reverse engineer, decompile, or disassemble any part of the service</li>
            <li>Upload malicious code or interfere with the service's operation</li>
            <li>Scrape, crawl, or collect data without authorization</li>
            <li>Impersonate any person or entity</li>
          </ul>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">6. Limitation of Liability</h2>
          <p class="legal-page__text">
            This service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, 
            we shall not be liable for any indirect, incidental, special, or consequential damages arising from 
            your use of the service. Our total liability for any claim shall not exceed the amount you have paid 
            us in the 12 months preceding the claim.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">7. Governing Law</h2>
          <p class="legal-page__text">
            These Terms of Service are governed by the laws of the <strong>Republic of South Africa</strong>. 
            Any disputes arising from these terms shall be resolved in the courts of Johannesburg, South Africa.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">8. Changes to Terms</h2>
          <p class="legal-page__text">
            We reserve the right to modify these terms at any time. Changes will be effective immediately upon 
            posting. Your continued use of the service after changes constitutes acceptance of the modified terms. 
            We will notify you of material changes via email or a prominent notice on our website.
          </p>
        </section>

        <section class="legal-page__section">
          <h2 class="legal-page__heading">9. Contact</h2>
          <p class="legal-page__text">
            For questions about these Terms of Service, please contact us at:<br>
            <strong>Email:</strong> legal&#64;mysongs.com
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
  `],
})
export class TermsOfServiceComponent {}
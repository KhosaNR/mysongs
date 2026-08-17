/**
 * 404 Not Found page component.
 *
 * Displays when a user navigates to a route that doesn't exist.
 * Provides a branded illustration and navigation back to home.
 *
 * @example
 * ```html
 * <app-not-found />
 * ```
 */

import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

/**
 * 404 Not Found page with on-brand copy and illustration.
 *
 * Features:
 * - Large "404" display
 * - Descriptive message with music-themed tone
 * - Inline SVG illustration (headphones with question mark)
 * - "Back to Home" action button
 * - Accessible with proper ARIA roles
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found">
      <div class="not-found__container">
        <!-- Status Code -->
        <span class="not-found__status" aria-hidden="true">404</span>

        <!-- Illustration -->
        <span class="not-found__illustration" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <!-- Headphones base -->
            <path d="M4 14v-3a8 8 0 0 1 16 0v3"/>
            <path d="M18 19c0 1.5-1.5 2-3 2"/>
            <!-- Ear cups -->
            <rect x="2" y="14" width="5" height="7" rx="2"/>
            <rect x="17" y="14" width="5" height="7" rx="2"/>
            <!-- Question mark -->
            <path d="M9 9c0-1.5 1.5-3 3-3s3 1.5 3 3c0 1-.5 1.5-1 2l-1 1"/>
            <circle cx="12" cy="16.5" r=".5" fill="currentColor"/>
          </svg>
        </span>

        <!-- Title -->
        <h1 class="not-found__title">Page not found</h1>

        <!-- Message -->
        <p class="not-found__message">
          This track doesn't seem to exist. The page you're looking for
          may have been moved or is no longer available.
        </p>

        <!-- Action -->
        <button type="button" class="not-found__btn" (click)="goHome()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Back to Home
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .not-found {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: var(--space-8);
    }

    .not-found__container {
      text-align: center;
      max-width: 420px;
      animation: not-found-fade-in var(--transition-base) var(--ease-out);
    }

    @keyframes not-found-fade-in {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .not-found__status {
      display: block;
      font-size: 6rem;
      font-weight: 800;
      line-height: 1;
      color: color-mix(in srgb, var(--color-warning) 20%, var(--text-primary));
      margin-bottom: var(--space-2);
      letter-spacing: -0.05em;
    }

    .not-found__illustration {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      color: var(--color-warning);
      margin-bottom: var(--space-5);
    }

    .not-found__illustration svg {
      width: 100%;
      height: 100%;
    }

    .not-found__title {
      font-size: var(--text-2xl);
      font-weight: var(--weight-normal);
      color: var(--text-heading);
      margin: 0 0 var(--space-3);
      line-height: var(--leading-tight);
    }

    .not-found__message {
      font-size: var(--text-base);
      color: var(--text-secondary);
      margin: 0 0 var(--space-6);
      line-height: var(--leading-relaxed);
    }

    .not-found__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      border: none;
      line-height: var(--leading-normal);
      background: var(--accent-primary);
      color: var(--text-on-primary);
    }

    .not-found__btn svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .not-found__btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  `],
})
export class NotFoundComponent {
  private readonly router = inject(Router);

  /**
   * Navigate to the home route.
   */
  protected goHome(): void {
    this.router.navigate(['/']);
  }
}
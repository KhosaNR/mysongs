import { Component, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ROUTE, ROLE_LANDING } from '../../../core/constants/navigation.constants';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

/**
 * Landing route component shown while Firebase restores the auth session.
 *
 * Renders a centered loading spinner, then redirects to the role-based
 * landing page the moment auth state resolves:
 * - Admin → /admin
 * - Artist → /artist
 * - Guest/Listener → /explore
 *
 * @example
 * ```html
 * <app-home-redirect />
 * ```
 */
@Component({
  selector: 'app-home-redirect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingSpinnerComponent],
  template: `
    <div class="home-redirect">
      <app-loading-spinner size="lg" label="Loading..." />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
    }

    .home-redirect {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
})
export class HomeRedirectComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private navigated = false;

  constructor() {
    effect(() => {
      // Never redirect during SSR — the client restores the auth session.
      if (typeof window === 'undefined') return;
      if (!this.authService.isAuthReady() || this.navigated) return;

      this.navigated = true;
      const user = this.authService.currentUser();
      void this.router.navigateByUrl(
        user ? ROLE_LANDING[user.role] : ROUTE.EXPLORE,
        { replaceUrl: true },
      );
    });
  }
}
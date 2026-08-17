import { Component, effect, inject, signal } from '@angular/core';
import { AudioPlayerService } from './core/services/audio-player.service';
import { RouterOutlet, Router } from '@angular/router';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';
import { NetworkStatusComponent } from './shared/components/network-status/network-status.component';
import { AudioPlayerComponent } from './shared/components/audio-player/audio-player.component';
import { SiteHeaderComponent } from './shared/components/site-header/site-header.component';
import { SiteSidebarComponent } from './shared/components/site-sidebar/site-sidebar.component';
import { AuthService, AuthUser } from './core/services/auth.service';
import { SiteSettingsService } from './core/services/site-settings.service';
import { ROUTE, ROLE_LANDING } from './core/constants/navigation.constants';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CookieConsentComponent,
    NetworkStatusComponent,
    AudioPlayerComponent,
    SiteHeaderComponent,
    SiteSidebarComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly siteSettingsService = inject(SiteSettingsService);
  private readonly audioPlayerService = inject(AudioPlayerService);

  /**
   * Whether the global audio player has a track selected for streaming.
   */
  readonly hasActivePlayer = this.audioPlayerService.hasActiveTrack;

  /**
   * Whether the system-wide sidebar is open. Open by default on desktop;
   * collapsed behind the header hamburger on mobile.
   */
  readonly isSidebarOpen = signal(false);

  private previousUser: AuthUser | null | undefined;

  constructor() {
    // Sidebar is open by default on desktop; collapsed behind the hamburger on mobile.
    this.isSidebarOpen.set(typeof window !== 'undefined' && window.innerWidth >= 769);

    // Apply admin-configured platform colors before first paint (skipped on SSR).
    void this.siteSettingsService.load();

    effect(() => {
      const current = this.authService.currentUser();
      const previous = this.previousUser;
      this.previousUser = current;

      // Redirect only on a null → user transition (session restored at boot or login).
      if (!current || previous !== null) return;

      // Auth pages handle their own post-login redirect (with returnUrl support).
      if (this.router.url.startsWith(ROUTE.LOGIN) || this.router.url.startsWith(ROUTE.SIGN_UP)) return;

      const landing = ROLE_LANDING[current.role];
      if (this.router.url !== landing) {
        void this.router.navigateByUrl(landing, { replaceUrl: true });
      }
    });
  }

  /**
   * Toggles the system-wide sidebar open/closed.
   */
  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  /**
   * Collapses the system-wide sidebar.
   */
  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}
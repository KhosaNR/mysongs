import { Component, inject, input, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SearchInputComponent } from '../search-input/search-input.component';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { USER_ROLE, ROUTE, ROLE_LANDING } from '../../../core/constants/navigation.constants';

/**
 * Global site header with logo, search, account actions, and the hamburger
 * that toggles the system-wide sidebar.
 *
 * @example
 * ```html
 * <app-site-header (menuToggle)="toggleSidebar()" />
 * ```
 */
@Component({
  selector: 'app-site-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SearchInputComponent, BrandLogoComponent],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Current authenticated user, or null if not logged in.
   */
  protected readonly currentUser = this.authService.currentUser;

  readonly isArtist = computed(() => this.currentUser()?.role === USER_ROLE.ARTIST);
  readonly isAdmin = computed(() => this.currentUser()?.role === USER_ROLE.ADMIN);

  /**
   * Whether the system-wide sidebar is currently open (drives aria-expanded).
   */
  readonly isSidebarOpen = input(false);

  /**
   * Emitted when the user clicks the hamburger — the app shell toggles the
   * system-wide sidebar in response.
   */
  readonly menuToggle = output<void>();

  /**
   * Emits the sidebar toggle request.
   */
  protected onMenuToggle(): void {
    this.menuToggle.emit();
  }

  /**
   * Navigates to the search page with the provided query.
   * @param query - The search query string
   */
  protected onSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    this.router.navigate([ROUTE.SEARCH], { queryParams: { q: trimmed } });
  }

  /**
   * Navigates to the appropriate dashboard based on user role.
   */
  protected onDashboardClick(): void {
    const user = this.currentUser();
    if (user) {
      this.router.navigate([ROLE_LANDING[user.role]]);
    }
  }

  /**
   * Logs out the current user and navigates to explore.
   */
  protected async onLogout(): Promise<void> {
    const result = await this.authService.signOut();
    if (result.isSuccess()) {
      this.router.navigate([ROUTE.EXPLORE]);
    }
  }
}

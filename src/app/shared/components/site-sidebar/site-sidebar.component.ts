import {
  Component,
  inject,
  input,
  output,
  computed,
  signal,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterModule, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DbService } from '../../../core/services/db.service';
import { PlaylistService } from '../../../core/services/playlist.service';
import { Artist } from '../../../shared/models/artist.interface';
import { PlaylistWithId } from '../../../shared/models/playlist.interface';
import { USER_ROLE, ROUTE } from '../../../core/constants/navigation.constants';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

/** A single entry in the role-aware sidebar navigation. */
interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  readonly exact?: boolean;
}

/** A non-clickable category heading grouping related sidebar entries. */
interface NavSection {
  readonly heading: string;
  readonly items: NavItem[];
}

/**
 * System-wide persistent left sidebar shown on every screen and for every user
 * role (the same sidebar pattern used by the artist/admin layouts).
 *
 * On desktop it is open by default and only collapses via the header hamburger;
 * on mobile it behaves as an off-canvas drawer opened by the hamburger.
 */
@Component({
  selector: 'app-site-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, RouterLinkActive, BrandLogoComponent],
  templateUrl: './site-sidebar.component.html',
  styleUrl: './site-sidebar.component.scss',
})
export class SiteSidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly dbService = inject(DbService);
  private readonly playlistService = inject(PlaylistService);
  private readonly router = inject(Router);

  /**
   * Current authenticated user, or null when logged out.
   */
  protected readonly currentUser = this.authService.currentUser;

  /**
   * Artist profile photo URL, loaded from the artists collection when the
   * signed-in user is an artist (falls back to the initial-letter avatar).
   */
  protected readonly artistPhotoURL = signal<string | null>(null);

  /**
   * Playlists owned by the signed-in user, rendered as per-playlist sidebar
   * rows for listeners and artists.
   */
  readonly playlists = signal<PlaylistWithId[]>([]);

  /**
   * Whether the sidebar is open.
   */
  readonly isOpen = input(false);

  /**
   * Emitted when the sidebar should be collapsed (backdrop or close button).
   */
  readonly closeRequested = output<void>();

  constructor() {
    // Keep the footer photo in sync with the signed-in artist's profile.
    effect(() => {
      const user = this.currentUser();
      const artistId = user?.role === USER_ROLE.ARTIST ? user.artistId : undefined;
      if (!artistId) {
        this.artistPhotoURL.set(null);
        return;
      }
      void this.dbService.getDocument<Artist>('artists', artistId).then((result) => {
        if (result.isSuccess()) {
          this.artistPhotoURL.set(result.getData().data.photoURL || null);
        }
      });
    });

    // Keep the per-playlist rows in sync with the signed-in user. Only roles
    // with playlist access (listener/artist) load their own playlists here.
    effect(() => {
      const user = this.currentUser();
      const role = user?.role;
      if (user && (role === USER_ROLE.LISTENER || role === USER_ROLE.ARTIST)) {
        void this.loadPlaylists(user.userId);
      } else {
        this.playlists.set([]);
      }
    });
  }

  /**
   * Role-aware navigation links grouped under non-clickable category headings.
   */
  readonly navSections = computed<NavSection[]>(() => {
    const role = this.currentUser()?.role;
    const sections: NavSection[] = [
      {
        heading: 'Explore',
        items: [
          { path: ROUTE.EXPLORE, label: 'Explore', icon: 'explore', exact: true },
          { path: ROUTE.SEARCH, label: 'Search', icon: 'search' },
        ],
      },
    ];

    if (role === USER_ROLE.ARTIST) {
      sections.push({
        heading: 'My Content',
        items: [
          { path: '/artist/analytics', label: 'Analytics', icon: 'analytics' },
          { path: '/artist/profile', label: 'Profile', icon: 'person' },
          { path: '/artist/albums', label: 'Albums', icon: 'album' },
          { path: '/artist/songs', label: 'Songs', icon: 'music_note' },
          { path: '/artist/singles', label: 'Singles', icon: 'library_music' },
          { path: '/artist/videos', label: 'Videos', icon: 'video_library' },
          { path: '/artist/annotations', label: 'Lyrics', icon: 'notes' },
          { path: '/artist/collections', label: 'Collections', icon: 'collections_bookmark' },
        ],
      });
      sections.push({
        heading: 'Playlists',
        items: [
          { path: ROUTE.PLAYLISTS, label: 'My Playlists', icon: 'queue_music', exact: true },
          ...this.playlists().map((playlist) => ({
            path: `/playlist/${playlist.id}`,
            label: playlist.name,
            icon: 'queue_music',
          })),
        ],
      });
      sections.push({
        heading: 'Community',
        items: [{ path: '/artist/sponsors', label: 'Sponsors', icon: 'handshake' }],
      });
    } else if (role === USER_ROLE.ADMIN) {
      sections.push({
        heading: 'My Content',
        items: [
          { path: '/admin/dashboard', label: 'Admin Dashboard', icon: 'dashboard' },
          { path: '/admin/artists', label: 'Artists', icon: 'people' },
          { path: '/admin/tracks', label: 'Tracks', icon: 'music_note' },
          { path: '/admin/approvals', label: 'Approvals', icon: 'verified_user' },
          { path: '/admin/reports', label: 'Reports', icon: 'flag' },
          { path: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
          { path: '/admin/sales', label: 'Sales', icon: 'attach_money' },
          { path: '/admin/settings', label: 'Site Settings', icon: 'palette' },
        ],
      });
      sections.push({
        heading: 'Settings',
        items: [{ path: ROUTE.ACCOUNT, label: 'Account', icon: 'settings' }],
      });
    } else if (role === USER_ROLE.LISTENER) {
      sections.push({
        heading: 'My Content',
        items: [{ path: ROUTE.DASHBOARD, label: 'Dashboard', icon: 'dashboard' }],
      });
      sections.push({
        heading: 'Playlists',
        items: [
          { path: ROUTE.PLAYLISTS, label: 'My Playlists', icon: 'queue_music', exact: true },
          ...this.playlists().map((playlist) => ({
            path: `/playlist/${playlist.id}`,
            label: playlist.name,
            icon: 'queue_music',
          })),
        ],
      });
      sections.push({
        heading: 'Settings',
        items: [{ path: ROUTE.ACCOUNT, label: 'Account', icon: 'settings' }],
      });
    }
    return sections;
  });

  /**
   * Loads the signed-in user's playlists for the per-playlist sidebar rows.
   *
   * @param userId - Public application user ID
   */
  private async loadPlaylists(userId: string): Promise<void> {
    const result = await this.playlistService.getUserPlaylists(userId);
    if (result.isSuccess()) {
      this.playlists.set(result.getData());
    }
  }

  /**
   * Collapses the sidebar.
   */
  close(): void {
    this.closeRequested.emit();
  }

  /**
   * Logs out the current user and navigates to explore.
   */
  protected async onLogout(): Promise<void> {
    const result = await this.authService.signOut();
    if (result.isSuccess()) {
      this.close();
      this.router.navigate([ROUTE.EXPLORE]);
    }
  }
}

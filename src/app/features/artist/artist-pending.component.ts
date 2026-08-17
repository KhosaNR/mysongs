import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Standalone page shown to artists whose accounts are pending approval,
 * rejected, or suspended. Displays their current moderation status and
 * explains what to do next.
 */
@Component({
  selector: 'app-artist-pending',
  standalone: true,
  templateUrl: './artist-pending.component.html',
  styleUrl: './artist-pending.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtistPendingComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Current moderation status of the artist account. */
  readonly artistStatus = this.authService.currentUser()?.artistStatus ?? 'pending';

  /** Tracks back to the public explore page. */
  goToExplore(): void {
    this.router.navigate(['/explore']);
  }
}
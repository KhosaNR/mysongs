import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Thin route wrapper for the artist studio (`/artist/*`).
 *
 * Artist navigation (analytics, profile, albums, songs, sponsors, annotations)
 * lives in the system-wide `SiteSidebarComponent`, so this component only hosts
 * the routed artist screens inside the global app shell.
 */
@Component({
  selector: 'app-artist-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './artist-layout.component.html',
  styleUrl: './artist-layout.component.scss',
})
export class ArtistLayoutComponent {}

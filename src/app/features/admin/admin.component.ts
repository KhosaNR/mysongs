import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Thin route wrapper for the admin panel (`/admin/*`).
 *
 * Admin navigation (dashboard, artists, approvals, reports, analytics, sales,
 * sponsors, annotations, fan analytics, settings) lives in the system-wide
 * `SiteSidebarComponent`, so this component only hosts the routed admin screens
 * inside the global app shell.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {}

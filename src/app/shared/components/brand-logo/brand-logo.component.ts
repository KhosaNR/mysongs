import { Component, input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Theme-aware My Songs brand logo mark.
 *
 * Renders the two brand-logo assets and switches which one is visible via CSS,
 * keyed off the `data-theme` attribute on the document element (set by
 * `ThemeService.applyTheme`):
 *
 * - default / `dark` / `high-contrast` → `brand-logo-light.png` (white variant)
 * - `light` → `brand-logo.png` (original artwork)
 *
 * The images are decorative (`alt=""` + `aria-hidden`) because every usage sits
 * inside a labelled brand link with the "My Songs" wordmark beside it.
 *
 * @example
 * ```html
 * <a class="site-header__logo" routerLink="/" aria-label="My Songs home">
 *   <app-brand-logo size="32" />
 *   <span>My Songs</span>
 * </a>
 * ```
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
})
export class BrandLogoComponent {
  /**
   * Rendered height of the logo mark in pixels; the width scales automatically
   * to preserve the artwork's landscape aspect ratio.
   * @default 28
   */
  readonly size = input<number>(28);
}

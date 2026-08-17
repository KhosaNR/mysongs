/**
 * Lazy image loading directive.
 *
 * Uses `IntersectionObserver` to defer loading of `<img>` elements
 * and `background-image` CSS properties until they enter the viewport.
 *
 * ### Usage (img element):
 * ```html
 * <img [appLazyImage]="'/assets/artwork.jpg'" alt="Album art" />
 * ```
 *
 * ### Usage (background image):
 * ```html
 * <div [appLazyImageBg]="'/assets/bg.jpg'" class="hero"></div>
 * ```
 *
 * ### With optional placeholder:
 * ```html
 * <img
 *   [appLazyImage]="'/assets/artwork.jpg'"
 *   [appLazyImagePlaceholder]="'/assets/placeholder.jpg'"
 *   alt="Album art"
 * />
 * ```
 */
import {
  Directive,
  Input,
  HostBinding,
  ElementRef,
  inject,
  DestroyRef,
  signal,
  effect,
} from '@angular/core';

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Creates an IntersectionObserver that triggers a callback once an element
 * becomes visible, then disconnects.
 */
function createOnceObserver(
  element: Element,
  callback: () => void,
  options?: IntersectionObserverInit,
): IntersectionObserver {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      callback();
      observer.disconnect();
    }
  }, options);

  observer.observe(element);
  return observer;
}

// ============================================================================
// LAZY IMAGE DIRECTIVE (img[src])
// ============================================================================

@Directive({
  selector: '[appLazyImage]',
  standalone: true,
})
export class LazyImageDirective {
  // ==========================================================================
  // INPUTS
  // ==========================================================================

  /**
   * The actual image URL to load when the element becomes visible.
   */
  @Input({ alias: 'appLazyImage', required: true })
  lazySrc!: string;

  /**
   * Optional low-resolution placeholder URL to show before the actual image
   * loads. Applied as `src` immediately.
   */
  @Input()
  appLazyImagePlaceholder?: string;

  // ==========================================================================
  // HOST BINDINGS
  // ==========================================================================

  /** Prevents layout shift while the image loads. */
  @HostBinding('style.min-width')
  readonly minWidth = '1px';

  /** Prevents layout shift while the image loads. */
  @HostBinding('style.min-height')
  readonly minHeight = '1px';

  // ==========================================================================
  // STATE SIGNALS
  // ==========================================================================

  /**
   * Whether the image has finished loading.
   * Can be used for fade-in CSS transitions.
   */
  readonly hasLoaded = signal(false);

  /**
   * Whether the image failed to load.
   */
  readonly hasError = signal(false);

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  private readonly el: HTMLImageElement = inject(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;
  // The original `src` before lazy-loading (used for placeholder)
  private originalSrc = '';

  constructor() {
    // Guard: only apply to img elements
    if (!(this.el instanceof HTMLImageElement)) {
      console.warn(
        `[LazyImageDirective] Selector [appLazyImage] is intended for <img> elements. ` +
          `Use [appLazyImageBg] for background images.`,
      );
      return;
    }

    const destroyRef = inject(DestroyRef);

    // SSR guard
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: load immediately
      effect(() => {
        if (this.lazySrc) {
          this.#loadImage(this.lazySrc);
        }
      });
      return;
    }

    // Capture current src as placeholder, then clear it
    this.originalSrc = this.el.src || '';
    this.el.removeAttribute('src');

    // Set placeholder if provided
    if (this.appLazyImagePlaceholder) {
      this.el.src = this.appLazyImagePlaceholder;
    }

    // Use effect to react to lazySrc changes and observe
    effect(() => {
      const src = this.lazySrc;
      if (!src) {
        return;
      }

      this.#startObserving(src);
    });

    destroyRef.onDestroy(() => {
      this.#disconnect();
    });
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  #startObserving(src: string): void {
    this.#disconnect();

    this.observer = createOnceObserver(this.el, () => {
      this.#loadImage(src);
    });
  }

  #loadImage(src: string): void {
    const img = new Image();
    img.onload = () => {
      this.el.src = src;
      this.hasLoaded.set(true);
      this.hasError.set(false);
    };
    img.onerror = () => {
      this.hasError.set(true);
      // Restore placeholder if available
      if (this.appLazyImagePlaceholder) {
        this.el.src = this.appLazyImagePlaceholder;
      }
    };
    img.src = src;
  }

  #disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// ============================================================================
// LAZY BACKGROUND DIRECTIVE ([style.background-image])
// ============================================================================

@Directive({
  selector: '[appLazyImageBg]',
  standalone: true,
})
export class LazyBackgroundDirective {
  // ==========================================================================
  // INPUTS
  // ==========================================================================

  /**
   * The background image URL to load when the element becomes visible.
   * Applied as `background-image: url(...)`.
   */
  @Input({ alias: 'appLazyImageBg', required: true })
  lazyBgSrc!: string;

  // ==========================================================================
  // STATE SIGNALS
  // ==========================================================================

  /**
   * Whether the background image has finished loading.
   */
  readonly hasLoaded = signal(false);

  /**
   * Whether the background image failed to load.
   */
  readonly hasError = signal(false);

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  private readonly el: HTMLElement = inject(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // SSR guard
    if (typeof IntersectionObserver === 'undefined') {
      effect(() => {
        if (this.lazyBgSrc) {
          this.#applyBackground(this.lazyBgSrc);
        }
      });
      return;
    }

    effect(() => {
      const src = this.lazyBgSrc;
      if (!src) {
        return;
      }

      this.#startObserving(src);
    });

    destroyRef.onDestroy(() => {
      this.#disconnect();
    });
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  #startObserving(src: string): void {
    this.#disconnect();

    this.observer = createOnceObserver(this.el, () => {
      this.#applyBackground(src);
    });
  }

  #applyBackground(src: string): void {
    const img = new Image();
    img.onload = () => {
      this.el.style.backgroundImage = `url(${src})`;
      this.hasLoaded.set(true);
      this.hasError.set(false);
    };
    img.onerror = () => {
      this.hasError.set(true);
    };
    img.src = src;
  }

  #disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
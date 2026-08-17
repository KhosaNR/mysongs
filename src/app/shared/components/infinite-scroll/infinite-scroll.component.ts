/**
 * Infinite scroll / pagination component.
 *
 * Uses `IntersectionObserver` on a sentinel element at the bottom of the
 * content area to detect when the user has scrolled near the end. Emits a
 * signal when more content should be loaded.
 *
 * ### Usage:
 * ```html
 * <app-infinite-scroll
 *   [loading]="isLoading()"
 *   [hasMore]="hasMore()"
 *   (loadMore)="onLoadMore()"
 * >
 *   @for (item of items(); track item.id) {
 *     <div class="item">{{ item.name }}</div>
 *   }
 * </app-infinite-scroll>
 * ```
 */
import {
  Component,
  input,
  output,
  inject,
  DestroyRef,
  effect,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-infinite-scroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <div class="infinite-scroll">
      <!-- Projected list content -->
      <div class="infinite-scroll__content">
        <ng-content />
      </div>

      <!-- Sentinel element for IntersectionObserver -->
      <div #sentinel class="infinite-scroll__sentinel" aria-hidden="true">
        @if (loading()) {
          <app-loading-spinner
            variant="spinner"
            size="sm"
            label="Loading more..."
          />
        } @else if (!hasMore() && !loading()) {
          <app-empty-state
            icon="empty-box"
            [description]="endMessage()"
          />
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .infinite-scroll {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .infinite-scroll__content {
        display: contents;
      }

      .infinite-scroll__sentinel {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 64px;
        padding: var(--space-4) 0;
      }
    `,
  ],
})
export class InfiniteScrollComponent {
  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * Whether more items are currently being loaded.
   * When `true`, shows a spinner at the bottom.
   */
  readonly loading = input.required<boolean>();

  /**
   * Whether there are more items to load.
   * When `false`, shows the end-of-list message and disables the observer.
   */
  readonly hasMore = input.required<boolean>();

  /**
   * IntersectionObserver threshold (0–1).
   * Fraction of the sentinel that must be visible to trigger.
   * @default 0.1
   */
  readonly threshold = input<number>(0.1);

  /**
   * Root margin for IntersectionObserver.
   * Triggers the load earlier when negative values are used.
   * @default '100px'
   */
  readonly rootMargin = input<string>('100px');

  /**
   * Message displayed when all items have been loaded.
   * @default 'All items loaded'
   */
  readonly endMessage = input<string>('All items loaded');

  // ==========================================================================
  // OUTPUTS
  // ==========================================================================

  /**
   * Emitted when the sentinel enters the viewport and more items should
   * be fetched. The parent should increment its page offset and load data.
   */
  readonly loadMore = output<void>();

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  private readonly sentinelEl: ElementRef<HTMLDivElement> =
    inject(ElementRef);
  private observer: IntersectionObserver | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // SSR guard
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    // Reactively start/stop observing when inputs change
    effect(() => {
      const loading = this.loading();
      const hasMore = this.hasMore();

      if (!hasMore || loading) {
        this.#disconnect();
        return;
      }

      // Wait for DOM to render the sentinel, then observe
      queueMicrotask(() => this.#startObserving());
    });

    destroyRef.onDestroy(() => {
      this.#disconnect();
    });
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  #startObserving(): void {
    this.#disconnect();

    const sentinel = this.sentinelEl.nativeElement.querySelector(
      '.infinite-scroll__sentinel',
    ) as HTMLElement | null;

    if (!sentinel) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !this.loading() && this.hasMore()) {
          this.loadMore.emit();
        }
      },
      {
        threshold: this.threshold(),
        rootMargin: this.rootMargin(),
      },
    );

    this.observer.observe(sentinel);
  }

  #disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
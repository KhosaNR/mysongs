/**
 * Search input component with debounced signal output.
 *
 * Provides a styled search input with search icon, clear button, loading
 * indicator, and debounced search query emission. Supports two-way binding
 * via Angular's model() for external control.
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <app-search-input (searched)="onSearch($event)" />
 *
 * <!-- With loading state and two-way binding -->
 * <app-search-input
 *   [(value)]="query"
 *   [loading]="isSearching()"
 *   placeholder="Search tracks..."
 *   (searched)="onSearch($event)"
 *   (clear)="onClear()"
 * />
 * ```
 */

import {
  Component,
  input,
  output,
  model,
  ChangeDetectionStrategy,
  signal,
  effect,
  inject,
  DestroyRef,
} from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, filter, tap } from 'rxjs';

/**
 * Search input component with debounced search signal.
 *
 * Features:
 * - Debounced search query emission (configurable delay)
 * - Two-way model binding for external value control
 * - Search icon (magnifying glass) on the left
 * - Clear button when input has text
 * - Loading spinner replaces search icon during active search
 * - Disabled state support
 * - WCAG accessible with proper labels and roles
 * - CSS custom property integration for theming
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="search-input"
      [class.search-input--disabled]="disabled()"
      [class.search-input--focused]="isFocused()"
      [class.search-input--loading]="loading()"
    >
      <!-- Search / Loading Icon -->
      <span class="search-input__icon" aria-hidden="true">
        @if (loading()) {
          <svg
            class="search-input__spinner"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              opacity="0.2"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        }
      </span>

      <!-- Input -->
      <input
        #inputEl
        type="search"
        class="search-input__field"
        [attr.placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel()"
        [disabled]="disabled()"
        [value]="value()"
        (input)="onInput($event)"
        (focus)="isFocused.set(true)"
        (blur)="isFocused.set(false)"
        (keydown)="onKeydown($event)"
      />

      <!-- Clear Button -->
      @if (value() && !disabled()) {
        <button
          type="button"
          class="search-input__clear"
          (click)="onClear()"
          aria-label="Clear search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .search-input {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 0 var(--space-3);
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      min-height: var(--touch-target-min);
    }

    .search-input:hover {
      border-color: var(--border-secondary);
    }

    .search-input--focused {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 20%, transparent);
    }

    .search-input--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .search-input--disabled .search-input__field {
      cursor: not-allowed;
    }

    /* ========================================================================
       ICON
       ======================================================================== */

    .search-input__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      color: var(--text-tertiary);
    }

    .search-input__icon svg {
      width: 100%;
      height: 100%;
    }

    .search-input__spinner {
      animation: search-spin 1s linear infinite;
    }

    @keyframes search-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .search-input__spinner path {
      stroke: var(--accent-primary);
    }

    /* ========================================================================
       INPUT FIELD
       ======================================================================== */

    .search-input__field {
      flex: 1;
      min-width: 0;
      padding: var(--space-2) 0;
      background: transparent;
      border: none;
      outline: none;
      font-size: var(--text-base);
      font-family: var(--font-family-primary);
      color: var(--text-primary);
      line-height: var(--leading-normal);
    }

    .search-input__field::placeholder {
      color: var(--text-tertiary);
    }

    /* Remove default search styling in Webkit */
    .search-input__field::-webkit-search-decoration,
    .search-input__field::-webkit-search-cancel-button,
    .search-input__field::-webkit-search-results-button,
    .search-input__field::-webkit-search-results-decoration {
      -webkit-appearance: none;
      display: none;
    }

    /* Remove default clear in Edge */
    .search-input__field::-ms-clear,
    .search-input__field::-ms-reveal {
      display: none;
    }

    /* ========================================================================
       CLEAR BUTTON
       ======================================================================== */

    .search-input__clear {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-tertiary);
      transition: all var(--transition-fast);
    }

    .search-input__clear:hover {
      background: var(--color-hover);
      color: var(--text-primary);
    }

    .search-input__clear svg {
      width: 16px;
      height: 16px;
    }
  `],
})
export class SearchInputComponent {
  // ==========================================================================
  // SIGNAL INPUTS
  // ==========================================================================

  /**
   * Placeholder text for the search input.
   * @default 'Search...'
   */
  readonly placeholder = input<string>('Search...');

  /**
   * Debounce delay in milliseconds before emitting search events.
   * @default 300
   */
  readonly debounceMs = input<number>(300);

  /**
   * Whether to show the loading spinner state.
   * Replaces the search icon with a spinning indicator.
   * @default false
   */
  readonly loading = input<boolean>(false);

  /**
   * Whether the input is disabled.
   * @default false
   */
  readonly disabled = input<boolean>(false);

  /**
   * Accessible label for the search input.
   * @default 'Search'
   */
  readonly ariaLabel = input<string>('Search');

  /**
   * Two-way model binding for the search value.
   * Allows external control of the input value.
   * @default ''
   */
  readonly value = model<string>('');

  // ==========================================================================
  // SIGNAL OUTPUTS
  // ==========================================================================

  /**
   * Emits the debounced search query string.
   * Fires after the debounce delay since the last input change,
   * and only when the value has actually changed.
   */
  readonly searched = output<string>();

  /**
   * Emitted when the user clears the input (via clear button or Escape key).
   */
  readonly clear = output<void>();

  // ==========================================================================
  // INTERNAL STATE
  // ==========================================================================

  /**
   * Whether the input currently has focus.
   */
  protected readonly isFocused = signal<boolean>(false);

  // ==========================================================================
  // DEBOUNCE SUBJECT
  // ==========================================================================

  /**
   * Subject for debouncing search input changes.
   */
  private readonly searchSubject = new Subject<string>();

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Set up debounced search pipeline
    effect(() => {
      const debounceMs = this.debounceMs();

      const subscription = this.searchSubject
        .pipe(
          debounceTime(debounceMs),
          distinctUntilChanged(),
          filter((value) => value !== null),
          tap((value) => {
            this.searched.emit(value);
          }),
        )
        .subscribe();

      this.destroyRef.onDestroy(() => {
        subscription.unsubscribe();
      });
    });
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle input changes.
   * Updates the model and pushes to debounce subject.
   */
  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newValue = input.value;

    this.value.set(newValue);
    this.searchSubject.next(newValue);
  }

  /**
   * Handle keyboard events.
   * Escape key clears the input.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.clearInput();
    }
  }

  /**
   * Handle clear button click.
   * Clears the input and emits notifications.
   */
  protected onClear(): void {
    this.clearInput();
  }

  /**
   * Internal clear logic.
   * Resets the model, pushes to subject, emits clear output.
   */
  private clearInput(): void {
    this.value.set('');
    this.searchSubject.next('');
    this.clear.emit();
  }
}
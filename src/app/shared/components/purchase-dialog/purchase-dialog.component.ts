import { Component, inject, input, output, ChangeDetectionStrategy, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, form, required, min, max, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ModalDialogComponent } from '../modal-dialog/modal-dialog.component';
import { Song } from '../../models/song.interface';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

/**
 * Dialog state for the download/purchase flow.
 */
export type PurchaseDialogState = 'closed' | 'guest' | 'confirm' | 'purchasing' | 'success' | 'error';

/**
 * Purchaseable album summary passed to the dialog. Albums use the same PWYW
 * flow as songs: a standard price with a payable floor.
 */
export interface AlbumPurchaseItem {
  readonly id: string;
  readonly title: string;
  readonly priceZAR?: number;
  readonly minimumPriceZAR?: number;
  readonly artistName?: string;
  readonly trackCount?: number;
}

/**
 * Purchase confirmation dialog for the download flow.
 *
 * When a user clicks "Download" on a track or "Buy Album" on an album:
 * - Guest → shows "Sign in to download" with Login/Sign Up buttons
 * - Logged in, not purchased → shows the standard price pre-filled with a
 *   pay-what-you-want input (floor = minimum price, or the standard price
 *   when no minimum is configured) with confirm/cancel
 * - Logged in, purchased → dialog stays closed, download proceeds immediately
 *
 * @example
 * ```html
 * <app-purchase-dialog
 *   [state]="dialogState()"
 *   [song]="selectedSong()"
 *   [errorMessage]="purchaseError()"
 *   (close)="closeDialog()"
 *   (purchase)="onConfirmPurchase($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-purchase-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalDialogComponent, FormField, FieldErrorsComponent],
  template: `
    <app-modal-dialog
      [isOpen]="state() !== 'closed'"
      title="{{ dialogTitle() }}"
      size="sm"
      (close)="onClose()"
    >
      <div class="purchase-dialog">
        @if (state() === 'guest') {
          <div class="purchase-dialog__body">
            <svg class="purchase-dialog__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <p class="purchase-dialog__message">
              Sign in to download <strong>{{ itemTitle() }}</strong> by {{ artistName() }}.
            </p>
            <div class="purchase-dialog__actions">
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--secondary"
                (click)="goToLogin()"
              >
                Login
              </button>
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--primary"
                (click)="goToRegister()"
              >
                Sign Up
              </button>
            </div>
          </div>
        }

        @if (state() === 'confirm' || state() === 'purchasing') {
          <div class="purchase-dialog__body">
            <svg class="purchase-dialog__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p class="purchase-dialog__message">
              <strong>{{ itemTitle() }}</strong>
              @if (album(); as album) { <span>· {{ album.trackCount || 'all' }} track{{ album.trackCount === 1 ? '' : 's' }}</span> }
              — standard price <strong>R{{ standardPrice().toFixed(2) }}</strong>.
              Purchase to download the high-quality MP3.
            </p>
            <div class="purchase-dialog__price">
              <label class="purchase-dialog__price-label" for="purchaseAmount">Your price (ZAR)</label>
              <input
                class="purchase-dialog__price-input"
                type="number"
                id="purchaseAmount"
                step="0.01"
                [formField]="priceForm.amount"
                [attr.aria-label]="'Amount in Rand to pay for ' + itemTitle()"
              />
              <app-field-errors [field]="priceForm.amount" />
              <p class="purchase-dialog__price-hint">
                Minimum R{{ effectiveMinimum().toFixed(2) }}. Pay the standard price or more to support the artist.
              </p>
            </div>
            <div class="purchase-dialog__actions">
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--secondary"
                (click)="onClose()"
                [disabled]="state() === 'purchasing'"
              >
                Cancel
              </button>
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--primary"
                (click)="onPurchase()"
                [disabled]="state() === 'purchasing' || priceForm().invalid()"
              >
                @if (state() === 'purchasing') {
                  <svg class="purchase-dialog__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.2"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  </svg>
                  <span>Processing...</span>
                } @else {
                  <span>Confirm Purchase</span>
                }
              </button>
            </div>
          </div>
        }

        @if (state() === 'success') {
          <div class="purchase-dialog__body">
            <svg class="purchase-dialog__icon purchase-dialog__icon--success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p class="purchase-dialog__message">
              Purchase successful! Your download will start shortly.
            </p>
            <div class="purchase-dialog__actions">
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--primary"
                (click)="onClose()"
              >
                Done
              </button>
            </div>
          </div>
        }

        @if (state() === 'error') {
          <div class="purchase-dialog__body">
            <svg class="purchase-dialog__icon purchase-dialog__icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p class="purchase-dialog__message">
              {{ errorMessage() || 'Purchase failed. Please try again.' }}
            </p>
            <div class="purchase-dialog__actions">
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--secondary"
                (click)="onClose()"
              >
                Close
              </button>
              <button
                type="button"
                class="purchase-dialog__btn purchase-dialog__btn--primary"
                (click)="onPurchase()"
              >
                Try Again
              </button>
            </div>
          </div>
        }
      </div>
    </app-modal-dialog>
  `,
  styles: [`
    .purchase-dialog {
      display: flex;
      flex-direction: column;
    }

    .purchase-dialog__body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      text-align: center;
    }

    .purchase-dialog__icon {
      width: 48px;
      height: 48px;
      color: var(--text-tertiary);
    }

    .purchase-dialog__icon--success {
      color: var(--color-success);
    }

    .purchase-dialog__icon--error {
      color: var(--color-error);
    }

    .purchase-dialog__message {
      margin: 0;
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--text-secondary);
    }

    .purchase-dialog__message strong {
      color: var(--text-primary);
    }

    .purchase-dialog__price {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
    }

    .purchase-dialog__price-label {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }

    .purchase-dialog__price-input {
      width: 100%;
      min-height: var(--touch-target-min);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-base);
      font-family: var(--font-family-primary);
      color: var(--text-primary);
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
    }

    .purchase-dialog__price-input:focus {
      outline: none;
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 25%, transparent);
    }

    .purchase-dialog__price-hint {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .purchase-dialog__actions {
      display: flex;
      gap: var(--space-3);
      width: 100%;
    }

    .purchase-dialog__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      flex: 1;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      cursor: pointer;
      transition: all var(--transition-fast);
      min-height: var(--touch-target-min);
      border: 1px solid transparent;
    }

    .purchase-dialog__btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .purchase-dialog__btn--primary {
      background: var(--accent-primary);
      color: var(--text-inverse);
    }

    .purchase-dialog__btn--primary:hover:not(:disabled) {
      opacity: 0.9;
    }

    .purchase-dialog__btn--secondary {
      background: transparent;
      border-color: var(--border-primary);
      color: var(--text-secondary);
    }

    .purchase-dialog__btn--secondary:hover:not(:disabled) {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .purchase-dialog__spinner {
      width: 16px;
      height: 16px;
      animation: purchase-dialog-spin 1s linear infinite;
    }

    .purchase-dialog__spinner path {
      stroke: currentColor;
    }

    @keyframes purchase-dialog-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class PurchaseDialogComponent {
  private readonly router = inject(Router);

  /**
   * Current dialog state.
   */
  readonly state = input<PurchaseDialogState>('closed');

  /**
   * The song the user is trying to download.
   */
  readonly song = input<Song | null>(null);

  /**
   * The album the user is trying to buy (whole-album purchase).
   */
  readonly album = input<AlbumPurchaseItem | null>(null);

  /**
   * Error message to display in error state.
   */
  readonly errorMessage = input<string>('');

  /**
   * Emitted when the dialog should be closed.
   */
  readonly dismiss = output<void>();

  /**
   * Emitted when the user confirms the purchase, carrying the chosen amount.
   */
  readonly purchase = output<number>();

  /**
   * Title of the item being purchased (song or album).
   */
  protected readonly itemTitle = computed(
    () => this.song()?.title ?? this.album()?.title ?? ''
  );

  /**
   * Artist display name for dialog text.
   */
  protected readonly artistName = computed(
    () => this.song()?.writtenBy ?? this.album()?.artistName ?? 'this artist'
  );

  /**
   * Standard price shown by default, sourced from the DB value.
   */
  protected readonly standardPrice = computed(
    () => this.song()?.priceZAR ?? this.album()?.priceZAR ?? 0
  );

  /**
   * Payable floor: the configured minimum price, or the standard price when
   * no minimum is set.
   */
  protected readonly effectiveMinimum = computed(() => {
    const minimum = this.song()?.minimumPriceZAR ?? this.album()?.minimumPriceZAR ?? 0;
    const standard = this.standardPrice();
    return minimum > 0 ? minimum : standard;
  });

  /** Pay-what-you-want amount model, defaulting to the standard price. */
  protected readonly priceFormData = signal({ amount: this.standardPrice() });

  /** Pay-what-you-want amount form with a minimum floor. */
  protected readonly priceForm = form(this.priceFormData, (p) => {
    required(p.amount, { message: 'Price is required' });
    min(p.amount, 0, { message: 'Price cannot be negative' });
    max(p.amount, 1000, { message: 'Amount cannot exceed R1,000.00' });
    validate(p.amount, (ctx) => {
      const amount = ctx.value();
      const minimum = this.effectiveMinimum();
      if (amount < minimum) {
        return { kind: 'min', message: `Amount must be at least R${minimum.toFixed(2)}` };
      }
      return undefined;
    });
  });

  /** Stable identity of the currently shown purchaseable item. */
  private readonly itemKey = computed(() => {
    const song = this.song();
    const album = this.album();
    return song ? `song:${song.songId}` : album ? `album:${album.id}` : '';
  });

  /**
   * Resets the amount to the item's standard price whenever a different item is
   * shown in the dialog. User edits are preserved for the current item.
   * @private
   */
  private lastItemKey = '';
  private readonly priceSyncEffect = effect(() => {
    const key = this.itemKey();
    if (!key || key === this.lastItemKey) return;
    this.lastItemKey = key;
    this.priceFormData.set({ amount: this.standardPrice() });
  });

  /**
   * Dialog title based on state.
   */
  protected readonly dialogTitle = () => {
    switch (this.state()) {
      case 'guest':
        return 'Sign in to download';
      case 'confirm':
      case 'purchasing':
        return 'Confirm Purchase';
      case 'success':
        return 'Purchase Successful';
      case 'error':
        return 'Purchase Failed';
      default:
        return 'Download';
    }
  };

  /**
   * Internal close handler that emits the close event.
   */
  protected onClose(): void {
    this.dismiss.emit();
  }

  /**
   * Internal purchase handler that emits the chosen amount.
   */
  protected onPurchase(): void {
    if (this.priceForm().invalid()) return;
    this.purchase.emit(this.priceFormData().amount);
  }

  /**
   * Navigates to the login page.
   */
  protected goToLogin(): void {
    this.onClose();
    this.router.navigate(['/auth/login']);
  }

  /**
   * Navigates to the register page.
   */
  protected goToRegister(): void {
    this.onClose();
    this.router.navigate(['/auth/register']);
  }
}
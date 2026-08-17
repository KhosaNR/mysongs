/**
 * Track row component for displaying a song in list context.
 *
 * Provides a consistent row layout showing artwork, title, artist,
 * duration, purchase status, and interactive actions (play/download/share).
 */

import { Component, input, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Song } from '../../models/song.interface';

@Component({
  selector: 'app-track-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
  template: `
    <div
      class="track-row"
      [class.track-row--playing]="isPlaying()"
      [class.track-row--purchased]="purchased()"
      role="listitem"
      [attr.aria-label]="ariaLabel()"
    >
      <!-- Artwork -->
      <div class="track-row__artwork" aria-hidden="true">
        @if (artworkUrl()) {
          <img
            [src]="artworkUrl()"
            [alt]="song().title + ' artwork'"
            class="track-row__artwork-img"
            loading="lazy"
          />
        } @else {
          <svg class="track-row__artwork-placeholder" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
        }
      </div>

      <!-- Track Info -->
      <div class="track-row__info">
        <a class="track-row__title" [routerLink]="['/song', song().id ?? song().songId]">{{
          song().title
        }}</a>
        <div class="track-row__byline">
          @if (artistName(); as artist) {
            <a class="track-row__artist-link" [routerLink]="['/artist', song().artistId]">{{
              artist
            }}</a>
            @if (albumTitle(); as album) {
              <span class="track-row__byline-sep" aria-hidden="true">·</span>
              <a class="track-row__album-link" [routerLink]="['/album', song().albumId]">{{
                album
              }}</a>
            }
          } @else if (credits().text; as text) {
            <span class="track-row__artist" [class.track-row__artist--featured]="text">{{
              text
            }}</span>
          }
        </div>
      </div>

      <!-- Duration -->
      @if (song().duration; as duration) {
        <span class="track-row__duration" aria-label="Duration: {{ formatDuration(duration) }}">
          {{ formatDuration(duration) }}
        </span>
      }

      <!-- Purchase Status / Download -->
      <div class="track-row__actions">
        @if (purchased()) {
          <span class="track-row__purchased-badge" aria-label="Purchased">
            <svg
              class="track-row__check-icon"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"
              />
            </svg>
            <span class="track-row__purchased-text">Owned</span>
          </span>
        } @else if (song().priceZAR > 0) {
          @if (canPurchase()) {
            <button
              type="button"
              class="track-row__purchase-btn"
              (click)="onDownloadClick($event)"
              [attr.aria-label]="'Download ' + song().title"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                class="track-row__download-icon"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span class="track-row__price">Download</span>
            </button>
          } @else {
            <button
              type="button"
              class="track-row__purchase-btn track-row__purchase-btn--login"
              (click)="onDownloadClick($event)"
              [attr.aria-label]="'Sign in to download ' + song().title"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                class="track-row__download-icon"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span class="track-row__price">Sign in to Download</span>
            </button>
          }
        }

        <!-- Play Button -->
        <button
          type="button"
          class="track-row__play-btn"
          [class.track-row__play-btn--playing]="isPlaying()"
          (click)="onPlayClick($event)"
          [attr.aria-label]="isPlaying() ? 'Pause ' + song().title : 'Play ' + song().title"
        >
          @if (isPlaying()) {
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              class="track-row__action-icon"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          } @else {
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              class="track-row__action-icon"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          }
        </button>

        <!-- Share Button -->
        <button
          type="button"
          class="track-row__share-btn"
          (click)="onShareClick($event)"
          [attr.aria-label]="'Share ' + song().title"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="track-row__action-icon"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>

        <!-- Edit (owner artist or admin) -->
        @if (canEdit()) {
          <button
            type="button"
            class="track-row__edit-btn"
            (click)="onEditClick($event)"
            [attr.aria-label]="'Edit ' + song().title"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="track-row__action-icon"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        }

        <!-- Delete (owner artist or admin) -->
        @if (canDelete()) {
          <button
            type="button"
            class="track-row__delete-btn"
            (click)="onDeleteClick($event)"
            [attr.aria-label]="'Delete ' + song().title"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="track-row__action-icon"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        }

        <!-- Add to Playlist -->
        <button
          type="button"
          class="track-row__playlist-btn"
          (click)="onAddToPlaylistClick($event)"
          [attr.aria-label]="'Add ' + song().title + ' to playlist'"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="track-row__action-icon"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .track-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        transition: background-color var(--transition-fast);
        min-height: 56px;
      }

      .track-row:hover {
        background-color: var(--color-hover);
      }

      .track-row:focus-within {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .track-row--playing {
        background-color: var(--color-hover);
      }

      .track-row--playing .track-row__title {
        color: var(--accent-primary);
      }

      /* ARTWORK */
      .track-row__artwork {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .track-row__artwork-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .track-row__artwork-placeholder {
        width: 20px;
        height: 20px;
        color: var(--text-tertiary);
      }

      /* TRACK INFO */
      .track-row__info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .track-row__title {
        font-size: var(--text-base);
        font-weight: var(--weight-medium);
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-decoration: none;
        display: block;
        min-width: 0;
      }

      .track-row__title:hover {
        color: var(--accent-primary);
      }

      .track-row__byline {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .track-row__artist-link,
      .track-row__album-link {
        color: var(--text-secondary);
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .track-row__artist-link:hover,
      .track-row__album-link:hover {
        color: var(--accent-primary);
      }

      .track-row__byline-sep {
        color: var(--text-tertiary);
        flex-shrink: 0;
      }

      .track-row__artist {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .track-row__artist--featured {
        color: var(--text-tertiary);
        font-style: italic;
      }

      /* DURATION */
      .track-row__duration {
        font-size: var(--text-sm);
        color: var(--text-tertiary);
        font-family: var(--font-family-mono);
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ACTIONS */
      .track-row__actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
      }

      .track-row__purchased-badge {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        background: var(--color-success);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-on-success);
        white-space: nowrap;
      }

      .track-row__check-icon {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .track-row__purchased-text {
        line-height: 1;
      }

      .track-row__purchase-btn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        background: var(--accent-primary);
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: var(--touch-target-min);
      }

      .track-row__purchase-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .track-row__purchase-btn:active {
        transform: translateY(0);
      }

      .track-row__purchase-btn--login {
        background: var(--color-warning);
      }

      .track-row__price {
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        color: var(--text-inverse);
        white-space: nowrap;
      }

      .track-row__download-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .track-row__play-btn,
      .track-row__share-btn,
      .track-row__playlist-btn,
      .track-row__edit-btn,
      .track-row__delete-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        background: transparent;
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-full);
        cursor: pointer;
        color: var(--text-secondary);
        transition: all var(--transition-fast);
        min-height: var(--touch-target-min);
        min-width: var(--touch-target-min);
      }

      .track-row__play-btn:hover,
      .track-row__share-btn:hover,
      .track-row__playlist-btn:hover,
      .track-row__edit-btn:hover,
      .track-row__delete-btn:hover {
        background: var(--color-hover);
        border-color: var(--border-secondary);
        color: var(--text-primary);
      }

      .track-row__delete-btn:hover {
        background: var(--color-error);
        border-color: var(--color-error);
        color: var(--text-inverse);
      }

      .track-row__play-btn--playing {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: var(--text-inverse);
      }

      .track-row__play-btn--playing:hover {
        background: var(--accent-primary);
        opacity: 0.9;
      }

      .track-row__action-icon {
        width: 18px;
        height: 18px;
      }

      @media (max-width: 480px) {
        .track-row {
          padding: var(--space-2);
          gap: var(--space-2);
        }

        .track-row__duration {
          display: none;
        }

        .track-row__purchased-text {
          display: none;
        }
      }
    `,
  ],
})
export class TrackRowComponent {
  /**
   * The song data to display in this row.
   * Required.
   */
  readonly song = input.required<Song & { readonly id?: string }>();

  /**
   * URL to the artwork image to display.
   * Falls back to a music icon placeholder if not provided.
   */
  readonly artworkUrl = input<string | null>(null);

  /**
   * Whether the current user has purchased this song.
   * @default false
   */
  readonly purchased = input<boolean>(false);

  /**
   * Whether the current user may purchase/download this song — i.e. is
   * authenticated with a granted role (listener, artist, or admin). Visitors
   * (authenticated with no granted role) see the sign-in CTA instead.
   * @default false
   */
  readonly canPurchase = input<boolean>(false);

  /**
   * Resolved artist display name for the clickable artist link.
   * Falls back to the inline credits line when not provided.
   */
  readonly artistName = input<string>('');

  /**
   * Resolved album title for the clickable album link (rendered only when the
   * song belongs to an album and a title is provided).
   */
  readonly albumTitle = input<string>('');

  /**
   * Whether this song is currently being played.
   * @default false
   */
  readonly isPlaying = input<boolean>(false);

  /**
   * Track number to display (1-indexed).
   * @default 0
   */
  readonly trackNumber = input<number>(0);

  /**
   * Emitted when the user clicks play/pause.
   */
  readonly playRequested = output<Song>();

  /**
   * Emitted when the user clicks download.
   */
  readonly download = output<Song>();

  /**
   * Emitted when the user clicks share.
   */
  readonly share = output<Song>();

  /**
   * Emitted when the user clicks the add-to-playlist action.
   */
  readonly addToPlaylist = output<Song>();

  /**
   * Whether the current user (owner artist or admin) may edit this song.
   * @default false
   */
  readonly canEdit = input<boolean>(false);

  /**
   * Emitted when an owner/admin clicks the edit action.
   */
  readonly editRequested = output<Song>();

  /**
   * Whether the current user (owner artist or admin) may delete this song.
   * @default false
   */
  readonly canDelete = input<boolean>(false);

  /**
   * Emitted when an owner/admin clicks the delete action.
   */
  readonly deleteRequested = output<Song>();

  /**
   * Track number display text: shows number, or dash if not available.
   */
  protected readonly trackNumberDisplay = computed(() => {
    const num = this.trackNumber();
    return num > 0 ? num.toString().padStart(2, '0') : '--';
  });

  /**
   * Combined credits line for the row's second line: 'feat. … | Prod. …'.
   * Each segment renders only when the corresponding field is present.
   * Falls back to the songwriters when neither a featured-artist nor a
   * producer credit exists so the artist line is not lost.
   */
  protected readonly credits = computed(() => {
    const song = this.song();
    const parts: string[] = [];
    if (song.featuredArtists) parts.push(`feat. ${song.featuredArtists}`);
    if (song.producers) parts.push(`Prod. ${song.producers}`);
    return {
      text: parts.length > 0 ? parts.join(' ') : (song.writtenBy ?? ''),
      featured: parts.length > 0,
    };
  });

  /**
   * Accessible label for the entire row.
   */
  protected readonly ariaLabel = computed(() => {
    const song = this.song();
    const status = this.purchased() ? ' - Purchased' : '';
    const playing = this.isPlaying() ? ' - Currently playing' : '';
    const credits = this.credits().text ? ` - ${this.credits().text}` : '';
    return `${song.title}${credits}${status}${playing}`;
  });

  /**
   * Format duration seconds into mm:ss display format.
   * @param seconds - Duration in seconds
   * @returns Formatted string (e.g., '3:45')
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Handle play/pause button click.
   */
  protected onPlayClick(event: Event): void {
    event.stopPropagation();
    this.playRequested.emit(this.song());
  }

  /**
   * Handle download button click.
   */
  protected onDownloadClick(event: Event): void {
    event.stopPropagation();
    this.download.emit(this.song());
  }

  /**
   * Handle share button click.
   */
  protected onShareClick(event: Event): void {
    event.stopPropagation();
    this.share.emit(this.song());
  }

  /**
   * Handle add-to-playlist button click.
   */
  protected onAddToPlaylistClick(event: Event): void {
    event.stopPropagation();
    this.addToPlaylist.emit(this.song());
  }

  /**
   * Handle edit button click (owner artist or admin only).
   */
  protected onEditClick(event: Event): void {
    event.stopPropagation();
    this.editRequested.emit(this.song());
  }

  /**
   * Handle delete button click (owner artist or admin only).
   */
  protected onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.song());
  }
}

import { Component, inject, signal, computed, HostListener, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AudioPlayerService, Track } from '../../../core/services/audio-player.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import type { DownloadInfo } from '../../models/purchase.interface';
import { PurchaseDialogComponent, PurchaseDialogState } from '../purchase-dialog/purchase-dialog.component';
import { Song } from '../../models/song.interface';

/**
 * Represents the active tab in expanded state.
 */
type PlayerTab = 'now-playing' | 'playlist' | 'lyrics';

/**
 * Persistent global audio player component with mini-bar and expanded views.
 * 
 * Features:
 * - Mini-bar: Fixed bottom bar showing current track info and play/pause
 * - Expanded state: Slides up to reveal 3 tabs (Now Playing, Playlist, Lyrics)
 * - YouTube video manual toggle (only if youtubeVideoId exists)
 * - Keyboard shortcuts: Space (play/pause), ArrowLeft (prev), ArrowRight (next)
 * - Stall detection retry indicator and auto-resume on reconnect notification
 * - Responsive design with mobile-first approach
 * - WCAG AA compliant with proper focus management and aria labels
 * 
 * @example
 * ```html
 * <app-audio-player />
 * ```
 */
@Component({
  selector: 'app-audio-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, PurchaseDialogComponent],
  template: `
    @if (hasTrack()) {
    <div class="audio-player" [class.audio-player--expanded]="isExpanded()">
      
      <!-- Mini Bar (Collapsed State) -->
      @if (!isExpanded()) {
      <div class="audio-player__mini-bar" role="region" aria-label="Audio player mini bar">
        <div class="audio-player__mini-row">
          <!-- Expandable region: artwork + track info + status indicators -->
          <div
            class="audio-player__mini-main"
            (click)="onMiniBarClick($event)"
            (keydown.enter)="onMiniBarKeydown($event)"
            (keydown.space)="onMiniBarKeydown($event)"
            tabindex="0"
            aria-label="Expand player"
          >
            <!-- Album Artwork -->
            <div class="audio-player__mini-artwork">
              @if (currentTrack()?.artworkUrl; as artwork) {
                <img
                  [src]="artwork"
                  [alt]="currentTrack()?.title"
                  class="audio-player__mini-artwork-img"
                  loading="lazy"
                />
              } @else {
                <div class="audio-player__mini-artwork-placeholder">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              }
            </div>

            <!-- Track Info -->
            <div class="audio-player__mini-info">
              <a
                class="audio-player__mini-title"
                [routerLink]="currentTrack() ? ['/song', currentTrack()!.id] : null"
                (click)="onMiniBarLinkClick($event)"
              >{{ currentTrack()?.title || 'No track selected' }}</a>
              <div class="audio-player__mini-byline">
                <a
                  class="audio-player__mini-artist"
                  [routerLink]="currentTrack() ? ['/artist', currentTrack()!.artistId] : null"
                  (click)="onMiniBarLinkClick($event)"
                >{{ currentTrack()?.artist || '' }}</a>
                @if (currentTrack()?.albumId) {
                  <span class="audio-player__mini-byline-sep" aria-hidden="true">·</span>
                  <a
                    class="audio-player__mini-album"
                    [routerLink]="['/album', currentTrack()!.albumId]"
                    (click)="onMiniBarLinkClick($event)"
                  >{{ currentTrack()?.albumTitle || 'Album' }}</a>
                }
              </div>
            </div>

            <!-- Auto-resume indicator -->
            @if (autoResumed()) {
              <div class="audio-player__mini-auto-resume">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-9-9"/>
                  <polyline points="21 3 21 9 15 9"/>
                </svg>
                <span>Resumed</span>
              </div>
            }

            <!-- Retry indicator -->
            @if (isRetrying()) {
              <div class="audio-player__mini-retry">
                <svg class="audio-player__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                </svg>
                <span>Retrying...</span>
              </div>
            }
          </div>

          <!-- Transport controls -->
          <div class="audio-player__mini-controls">
            <!-- Previous Button -->
            <button
              type="button"
              class="audio-player__mini-nav-btn"
              (click)="playPrevious()"
              [disabled]="!canPlayPrevious()"
              aria-label="Previous track"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            <!-- Play/Pause Button -->
            <button
              type="button"
              class="audio-player__mini-play-btn"
              (click)="togglePlayPause($event)"
              [attr.aria-label]="isPlaying() ? 'Pause' : 'Play'"
              [disabled]="isLoading()"
            >
              @if (isLoading()) {
                <svg class="audio-player__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                </svg>
              } @else if (isPlaying()) {
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              }
            </button>

            <!-- Next Button -->
            <button
              type="button"
              class="audio-player__mini-nav-btn"
              (click)="playNext()"
              [disabled]="!canPlayNext()"
              aria-label="Next track"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/>
              </svg>
            </button>

            <!-- Expand Button -->
            <button
              type="button"
              class="audio-player__mini-expand-btn"
              (click)="expand($event)"
              aria-label="Expand player"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Seek Bar + Time -->
        <div class="audio-player__mini-progress">
          <span class="audio-player__time">{{ formatTime(currentTime()) }}</span>
          <div
            class="audio-player__progress-bar audio-player__progress-bar--mini"
            [class.audio-player__progress-bar--dragging]="isSeeking()"
            role="slider"
            tabindex="0"
            aria-label="Seek"
            [attr.aria-disabled]="duration() <= 0"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="duration()"
            [attr.aria-valuenow]="currentTime()"
            [attr.aria-valuetext]="formatTime(currentTime()) + ' of ' + formatTime(duration())"
            (click)="onSeekBarClick($event)"
            (pointerdown)="onSeekStart($event)"
            (pointermove)="onSeekMove($event)"
            (pointerup)="onSeekEnd($event)"
            (pointercancel)="onSeekEnd($event)"
            (keydown)="onSeekKeydown($event)"
          >
            <div class="audio-player__progress-fill" [style.width.%]="progressPercent()"></div>
            <div class="audio-player__progress-thumb" [style.left.%]="progressPercent()"></div>
          </div>
          <span class="audio-player__time">{{ formatTime(duration()) }}</span>
          @if (duration() > 0) {
          <span class="audio-player__time audio-player__time--remaining">-{{ formatTime(remainingTime()) }}</span>
          }
        </div>
      </div>
      }

      <!-- Expanded State -->
      @if (isExpanded()) {
      <div class="audio-player__expanded">
        
        <!-- Header -->
        <div class="audio-player__header">
          <h2 class="audio-player__header-title">Now Playing</h2>
          @if (currentTrack()?.title) {
            <span class="audio-player__header-shortcut-hint">Space · ← · →</span>
          }
          <button
            type="button"
            class="audio-player__collapse-btn"
            (click)="collapse($event)"
            aria-label="Collapse player"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        <!-- Tab Navigation -->
        <div class="audio-player__tabs" role="tablist">
          <button
            type="button"
            class="audio-player__tab"
            [class.audio-player__tab--active]="activeTab() === 'now-playing'"
            (click)="setTab('now-playing')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'now-playing'"
            aria-controls="panel-now-playing"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Now Playing</span>
          </button>

          <button
            type="button"
            class="audio-player__tab"
            [class.audio-player__tab--active]="activeTab() === 'playlist'"
            (click)="setTab('playlist')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'playlist'"
            aria-controls="panel-playlist"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Playlist</span>
          </button>

          <button
            type="button"
            class="audio-player__tab"
            [class.audio-player__tab--active]="activeTab() === 'lyrics'"
            (click)="setTab('lyrics')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'lyrics'"
            aria-controls="panel-lyrics"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <span>Lyrics</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="audio-player__content">
          
          <!-- Now Playing Tab -->
          @if (activeTab() === 'now-playing') {
          <div 
            class="audio-player__panel" 
            id="panel-now-playing"
            role="tabpanel"
          >
            <div class="audio-player__now-playing">
              <!-- Album Artwork -->
              <div class="audio-player__artwork">
                @if (currentTrack()?.artworkUrl; as artwork) {
                  <img 
                    [src]="artwork" 
                    [alt]="currentTrack()?.title"
                    class="audio-player__artwork-img"
                    loading="lazy"
                  />
                } @else {
                  <div class="audio-player__artwork-placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                }
              </div>

              <!-- Track Info -->
              <div class="audio-player__track-info">
                <a
                  class="audio-player__track-title"
                  [routerLink]="currentTrack() ? ['/song', currentTrack()!.id] : null"
                >{{ currentTrack()?.title || 'No track selected' }}</a>
                <div class="audio-player__track-byline">
                  <a
                    class="audio-player__track-artist"
                    [routerLink]="currentTrack() ? ['/artist', currentTrack()!.artistId] : null"
                  >{{ currentTrack()?.artist || '' }}</a>
                  @if (currentTrack()?.albumId) {
                    <span class="audio-player__track-byline-sep" aria-hidden="true">·</span>
                    <a
                      class="audio-player__track-album"
                      [routerLink]="['/album', currentTrack()!.albumId]"
                    >{{ currentTrack()?.albumTitle || 'Album' }}</a>
                  }
                </div>
              </div>

              <!-- Retry Indicator (expanded) -->
              @if (isRetrying()) {
                <div class="audio-player__retry-banner">
                  <svg class="audio-player__spinner audio-player__retry-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                  </svg>
                  <span>Playback interrupted. Retrying...</span>
                </div>
              }

              <!-- Auto-resume Banner (expanded) -->
              @if (autoResumed()) {
                <div class="audio-player__auto-resume-banner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-9-9"/>
                    <polyline points="21 3 21 9 15 9"/>
                  </svg>
                  <span>Connection restored. Resuming playback.</span>
                </div>
              }

              <!-- Progress Bar -->
              <div class="audio-player__progress">
                <div
                  class="audio-player__progress-bar"
                  [class.audio-player__progress-bar--dragging]="isSeeking()"
                  role="slider"
                  tabindex="0"
                  aria-label="Seek"
                  [attr.aria-disabled]="duration() <= 0"
                  [attr.aria-valuemin]="0"
                  [attr.aria-valuemax]="duration()"
                  [attr.aria-valuenow]="currentTime()"
                  [attr.aria-valuetext]="formatTime(currentTime()) + ' of ' + formatTime(duration())"
                  (click)="onSeekBarClick($event)"
                  (pointerdown)="onSeekStart($event)"
                  (pointermove)="onSeekMove($event)"
                  (pointerup)="onSeekEnd($event)"
                  (pointercancel)="onSeekEnd($event)"
                  (keydown)="onSeekKeydown($event)"
                >
                  <div class="audio-player__progress-fill" [style.width.%]="progressPercent()"></div>
                  <div class="audio-player__progress-thumb" [style.left.%]="progressPercent()"></div>
                </div>
                <div class="audio-player__progress-time">
                  <span>{{ formatTime(currentTime()) }}</span>
                  <span class="audio-player__progress-time-right">
                    <span>{{ formatTime(duration()) }}</span>
                    @if (duration() > 0) {
                    <span class="audio-player__time--remaining">-{{ formatTime(remainingTime()) }}</span>
                    }
                  </span>
                </div>
              </div>

              <!-- Playback Controls -->
              <div class="audio-player__controls">
                <button
                  type="button"
                  class="audio-player__control-btn"
                  (click)="playPrevious()"
                  [disabled]="!canPlayPrevious()"
                  aria-label="Previous track"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>

                <button
                  type="button"
                  class="audio-player__control-btn audio-player__control-btn--play"
                  (click)="togglePlayPause($event)"
                  [disabled]="isLoading()"
                  aria-label="{{ isPlaying() ? 'Pause' : 'Play' }}"
                >
                  @if (isLoading()) {
                    <svg class="audio-player__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                    </svg>
                  } @else if (isPlaying()) {
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  }
                </button>

                <button
                  type="button"
                  class="audio-player__control-btn"
                  (click)="playNext()"
                  [disabled]="!canPlayNext()"
                  aria-label="Next track"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
              </div>

              <!-- Keyboard shortcut hint -->
              @if (currentTrack()?.title) {
                <div class="audio-player__shortcut-hint">
                  <kbd>Space</kbd> Play/Pause · <kbd>←</kbd> Previous · <kbd>→</kbd> Next
                </div>
              }

              <!-- Action Buttons -->
              <div class="audio-player__actions">
                <!-- YouTube Toggle (only if youtubeVideoId exists) -->
                @if (currentTrack()?.youtubeVideoId) {
                  <button
                    type="button"
                    class="audio-player__action-btn"
                    (click)="toggleYouTube()"
                    [class.audio-player__action-btn--active]="showYouTube()"
                    aria-label="{{ showYouTube() ? 'Hide' : 'Show' }} YouTube video"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
                    </svg>
                    <span>Video</span>
                  </button>
                }

                <!-- Download Button (visible for all users) -->
                @if (isPurchasePending()) {
                  <button
                    type="button"
                    class="audio-player__action-btn audio-player__action-btn--loading"
                    disabled
                    aria-label="Processing download"
                  >
                    <svg class="audio-player__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                    </svg>
                    <span>Processing...</span>
                  </button>
                } @else if (isPurchased()) {
                  <button
                    type="button"
                    class="audio-player__action-btn audio-player__action-btn--success"
                    (click)="downloadTrack()"
                    aria-label="Download track"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Download</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    class="audio-player__action-btn audio-player__action-btn--buy"
                    (click)="onDownloadClick()"
                    aria-label="Download track"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Download</span>
                  </button>
                }

                <!-- Share Button -->
                <button
                  type="button"
                  class="audio-player__action-btn"
                  (click)="shareTrack()"
                  aria-label="Share track"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span>Share</span>
                </button>
              </div>

              <!-- Purchase Error -->
              @if (purchaseError()) {
                <div class="audio-player__purchase-error">
                  <span>{{ purchaseError() }}</span>
                  <button
                    type="button"
                    class="audio-player__purchase-error-dismiss"
                    (click)="dismissPurchaseError()"
                    aria-label="Dismiss error"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              }

              <!-- YouTube Video Embed -->
              @if (showYouTube() && currentTrack()?.youtubeVideoId) {
                <div class="audio-player__youtube">
                  <iframe
                    [src]="youtubeEmbedUrl()"
                    title="YouTube video player"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                  ></iframe>
                </div>
              }
            </div>
          </div>
          }

          <!-- Playlist Tab -->
          @if (activeTab() === 'playlist') {
          <div 
            class="audio-player__panel" 
            id="panel-playlist"
            role="tabpanel"
          >
            <div class="audio-player__playlist">
              @if (queue().length === 0) {
                <div class="audio-player__empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  <p>Your queue is empty</p>
                </div>
              } @else {
                <div class="audio-player__queue-list" role="list">
                  @for (track of queue(); track track.id; let i = $index) {
                    <div 
                      class="audio-player__queue-item"
                      [class.audio-player__queue-item--active]="i === currentIndex()"
                      (click)="playTrackAtIndex(i)"
                      role="listitem"
                      tabindex="0"
                      (keydown.enter)="playTrackAtIndex(i)"
                      (keydown.space)="playTrackAtIndex(i)"
                    >
                      <div class="audio-player__queue-item-info">
                        <div class="audio-player__queue-item-title">{{ track.title }}</div>
                        <div class="audio-player__queue-item-artist">{{ track.artist }}</div>
                      </div>
                      @if (i === currentIndex()) {
                        <svg class="audio-player__queue-item-indicator" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <rect x="3" y="2" width="3" height="12" rx="1"/>
                          <rect x="10" y="2" width="3" height="12" rx="1"/>
                        </svg>
                      }
                    </div>
                  }
                </div>

                <button
                  type="button"
                  class="audio-player__clear-queue-btn"
                  (click)="clearQueue()"
                >
                  Clear queue
                </button>
              }
            </div>
          </div>
          }

          <!-- Lyrics Tab -->
          @if (activeTab() === 'lyrics') {
          <div 
            class="audio-player__panel" 
            id="panel-lyrics"
            role="tabpanel"
          >
            <div class="audio-player__lyrics">
              @if (currentTrack()?.lyrics) {
                <p class="audio-player__lyrics-text">{{ currentTrack()?.lyrics }}</p>
              } @else {
                <div class="audio-player__empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                  <p>No lyrics available for this track</p>
                </div>
              }
            </div>
          </div>
          }
        </div>
      </div>
      }
    </div>

      <!-- Purchase Dialog -->
      <app-purchase-dialog
        [state]="dialogState()"
        [song]="dialogSong()"
        [errorMessage]="dialogError()"
        (dismiss)="closeDialog()"
        (purchase)="confirmPurchase($event)"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: var(--z-sticky);
      font-family: var(--font-family-primary);
    }

    .audio-player {
      background-color: var(--bg-elevated);
      border-top: 1px solid var(--border-primary);
      transition: all var(--transition-base);
    }

    .audio-player--expanded {
      height: 60vh;
      max-height: 600px;
      border-top: 1px solid var(--border-primary);
    }

    /* ========================================================================
       MINI BAR
       ======================================================================== */

    .audio-player__mini-bar {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      transition: background-color var(--transition-fast);
    }

    .audio-player__mini-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .audio-player__mini-main {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
      gap: var(--space-2);
      cursor: pointer;
      border-radius: var(--radius-sm);
    }

    .audio-player__mini-main:focus-visible {
      outline: 2px solid var(--accent-primary);
      outline-offset: 2px;
    }

    .audio-player__mini-controls {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      flex-shrink: 0;
    }

    .audio-player__mini-bar:hover {
      background-color: var(--color-hover);
    }

    /* Album Artwork */
    .audio-player__mini-artwork {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background-color: var(--bg-tertiary);
    }

    .audio-player__mini-artwork-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .audio-player__mini-artwork-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
    }

    .audio-player__mini-artwork-placeholder svg {
      width: 24px;
      height: 24px;
    }

    /* Track Info */
    .audio-player__mini-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .audio-player__mini-title {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none;
      min-width: 0;
    }

    .audio-player__mini-title:hover {
      color: var(--accent-primary);
    }

    .audio-player__mini-byline {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      min-width: 0;
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .audio-player__mini-artist,
    .audio-player__mini-album {
      color: var(--text-secondary);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .audio-player__mini-artist:hover,
    .audio-player__mini-album:hover {
      color: var(--accent-primary);
    }

    .audio-player__mini-byline-sep {
      color: var(--text-tertiary);
      flex-shrink: 0;
    }

    /* Auto-resume indicator */
    .audio-player__mini-auto-resume {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-success);
      white-space: nowrap;
      animation: audio-player-fade-in 0.3s ease-out;
    }

    .audio-player__mini-auto-resume svg {
      width: 14px;
      height: 14px;
    }

    /* Retry indicator */
    .audio-player__mini-retry {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-warning);
      white-space: nowrap;
      animation: audio-player-fade-in 0.3s ease-out;
    }

    .audio-player__mini-retry svg {
      width: 14px;
      height: 14px;
    }

    @keyframes audio-player-fade-in {
      from { opacity: 0; transform: translateX(-4px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* Play Button */
    .audio-player__mini-play-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      background: var(--accent-primary);
      border: none;
      border-radius: var(--radius-full);
      cursor: pointer;
      color: var(--text-inverse);
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .audio-player__mini-play-btn:hover:not(:disabled) {
      opacity: 0.9;
      transform: scale(1.05);
    }

    .audio-player__mini-play-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .audio-player__mini-play-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .audio-player__mini-play-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Spinner */
    .audio-player__spinner {
      width: 20px;
      height: 20px;
      animation: audio-player-spin 1s linear infinite;
    }

    @keyframes audio-player-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Expand Button */
    .audio-player__mini-expand-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-secondary);
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .audio-player__mini-expand-btn:hover {
      background-color: var(--color-hover);
      color: var(--text-primary);
    }

    .audio-player__mini-expand-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Transport Nav Buttons (Previous / Next) */
    .audio-player__mini-nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      cursor: pointer;
      color: var(--text-secondary);
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .audio-player__mini-nav-btn:hover:not(:disabled) {
      background-color: var(--color-hover);
      color: var(--text-primary);
    }

    .audio-player__mini-nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .audio-player__mini-nav-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Mini Progress Row */
    .audio-player__mini-progress {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
    }

    .audio-player__time {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      font-family: var(--font-family-mono);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .audio-player__time--remaining {
      opacity: 0.7;
    }

    /* ========================================================================
       EXPANDED STATE
       ======================================================================== */

    .audio-player__expanded {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* Header */
    .audio-player__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border-primary);
    }

    .audio-player__header-title {
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .audio-player__header-shortcut-hint {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      letter-spacing: 0.02em;
    }

    .audio-player__collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-secondary);
      transition: all var(--transition-fast);
    }

    .audio-player__collapse-btn:hover {
      background-color: var(--color-hover);
      color: var(--text-primary);
    }

    .audio-player__collapse-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Tabs */
    .audio-player__tabs {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-bottom: 1px solid var(--border-primary);
      overflow-x: auto;
    }

    .audio-player__tab {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      transition: all var(--transition-fast);
      white-space: nowrap;
      min-height: var(--touch-target-min);
    }

    .audio-player__tab:hover {
      background-color: var(--color-hover);
      color: var(--text-primary);
    }

    .audio-player__tab--active {
      background-color: var(--accent-primary);
      color: var(--text-inverse);
    }

    .audio-player__tab--active:hover {
      background-color: var(--accent-primary);
      opacity: 0.9;
    }

    .audio-player__tab svg {
      width: 16px;
      height: 16px;
    }

    /* Content */
    .audio-player__content {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-4);
    }

    .audio-player__panel {
      height: 100%;
    }

    /* ========================================================================
       NOW PLAYING TAB
       ======================================================================== */

    .audio-player__now-playing {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      max-width: 600px;
      margin: 0 auto;
    }

    /* Artwork */
    .audio-player__artwork {
      width: 200px;
      height: 200px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background-color: var(--bg-tertiary);
      box-shadow: var(--shadow-lg);
    }

    .audio-player__artwork-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .audio-player__artwork-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
    }

    .audio-player__artwork-placeholder svg {
      width: 80px;
      height: 80px;
    }

    /* Track Info */
    .audio-player__track-info {
      text-align: center;
      width: 100%;
    }

    .audio-player__track-title {
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--space-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none;
      display: block;
    }

    .audio-player__track-title:hover {
      color: var(--accent-primary);
    }

    .audio-player__track-byline {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: var(--space-1);
      font-size: var(--text-base);
      color: var(--text-secondary);
    }

    .audio-player__track-artist,
    .audio-player__track-album {
      color: var(--text-secondary);
      text-decoration: none;
    }

    .audio-player__track-artist:hover,
    .audio-player__track-album:hover {
      color: var(--accent-primary);
    }

    .audio-player__track-byline-sep {
      color: var(--text-tertiary);
    }

    /* Retry Banner */
    .audio-player__retry-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--color-warning);
      width: 100%;
      animation: audio-player-fade-in 0.3s ease-out;
    }

    .audio-player__retry-spinner {
      width: 16px;
      height: 16px;
    }

    /* Auto-resume Banner */
    .audio-player__auto-resume-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--color-success);
      width: 100%;
      animation: audio-player-fade-in 0.3s ease-out;
    }

    .audio-player__auto-resume-banner svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    /* Progress Bar */
    .audio-player__progress {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .audio-player__progress-bar {
      position: relative;
      width: 100%;
      height: 6px;
      background-color: var(--bg-tertiary);
      border-radius: var(--radius-full);
      cursor: pointer;
      touch-action: none;
      flex-shrink: 1;
    }

    .audio-player__progress-bar--mini {
      flex: 1;
    }

    .audio-player__progress-bar:hover .audio-player__progress-fill,
    .audio-player__progress-bar--dragging .audio-player__progress-fill {
      filter: brightness(1.3);
    }

    .audio-player__progress-bar:focus-visible {
      outline: 2px solid var(--accent-primary);
      outline-offset: 2px;
    }

    .audio-player__progress-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background-color: var(--accent-primary);
      transition: width var(--transition-fast);
    }

    .audio-player__progress-thumb {
      position: absolute;
      top: 50%;
      width: 3px;
      height: 14px;
      border-radius: var(--radius-full);
      background-color: var(--accent-primary);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-primary) 40%, transparent);
      transform: translate(-50%, -50%);
      transition: width var(--transition-fast), height var(--transition-fast);
      pointer-events: none;
    }

    .audio-player__progress-bar:hover .audio-player__progress-thumb,
    .audio-player__progress-bar--dragging .audio-player__progress-thumb,
    .audio-player__progress-bar:focus-visible .audio-player__progress-thumb {
      width: 12px;
      height: 12px;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-primary) 30%, transparent);
    }

    .audio-player__progress-time {
      display: flex;
      justify-content: space-between;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      font-family: var(--font-family-mono);
    }

    .audio-player__progress-time-right {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    /* Controls */
    .audio-player__controls {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .audio-player__control-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      cursor: pointer;
      color: var(--text-primary);
      transition: all var(--transition-fast);
    }

    .audio-player__control-btn:hover:not(:disabled) {
      background-color: var(--color-hover);
    }

    .audio-player__control-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .audio-player__control-btn svg {
      width: 24px;
      height: 24px;
    }

    .audio-player__control-btn--play {
      width: 64px;
      height: 64px;
      background: var(--accent-primary);
      color: var(--text-inverse);
    }

    .audio-player__control-btn--play:hover:not(:disabled) {
      background: var(--accent-primary);
      opacity: 0.9;
      transform: scale(1.05);
    }

    .audio-player__control-btn--play svg {
      width: 32px;
      height: 32px;
    }

    /* Keyboard shortcut hint */
    .audio-player__shortcut-hint {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }

    .audio-player__shortcut-hint kbd {
      display: inline-block;
      padding: 1px 5px;
      font-family: var(--font-family-mono);
      font-size: 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      line-height: 1.4;
      color: var(--text-secondary);
    }

    /* Action Buttons */
    .audio-player__actions {
      display: flex;
      gap: var(--space-2);
    }

    .audio-player__action-btn {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      transition: all var(--transition-fast);
      min-height: var(--touch-target-min);
    }

    .audio-player__action-btn:hover {
      background-color: var(--color-hover);
      border-color: var(--border-secondary);
      color: var(--text-primary);
    }

    .audio-player__action-btn--active {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
      color: var(--text-inverse);
    }

    .audio-player__action-btn--loading {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .audio-player__action-btn--success {
      background-color: color-mix(in srgb, var(--color-success) 20%, transparent);
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .audio-player__action-btn--success:hover {
      background-color: var(--color-success);
      color: var(--text-inverse);
    }

    .audio-player__action-btn--buy {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
      color: var(--text-inverse);
    }

    .audio-player__action-btn--buy:hover {
      opacity: 0.9;
    }

    .audio-player__action-btn svg {
      width: 16px;
      height: 16px;
    }

    /* Purchase Error Banner */
    .audio-player__purchase-error {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-error) 15%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--color-error);
      width: 100%;
      animation: audio-player-fade-in 0.3s ease-out;
    }

    .audio-player__purchase-error span {
      flex: 1;
    }

    .audio-player__purchase-error-dismiss {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--color-error);
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .audio-player__purchase-error-dismiss:hover {
      background-color: color-mix(in srgb, var(--color-error) 20%, transparent);
    }

    .audio-player__purchase-error-dismiss svg {
      width: 16px;
      height: 16px;
    }

    /* YouTube Embed */
    .audio-player__youtube {
      width: 100%;
      max-width: 560px;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-md);
      overflow: hidden;
      background-color: var(--bg-tertiary);
    }

    .audio-player__youtube iframe {
      width: 100%;
      height: 100%;
    }

    /* ========================================================================
       PLAYLIST TAB
       ======================================================================== */

    .audio-player__playlist {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      height: 100%;
    }

    .audio-player__queue-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .audio-player__queue-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: left;
      min-height: var(--touch-target-min);
    }

    .audio-player__queue-item:hover {
      background-color: var(--color-hover);
    }

    .audio-player__queue-item--active {
      background-color: var(--color-active);
      border-left: 3px solid var(--accent-primary);
    }

    .audio-player__queue-item-info {
      flex: 1;
      min-width: 0;
    }

    .audio-player__queue-item-title {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .audio-player__queue-item-artist {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .audio-player__queue-item-indicator {
      width: 16px;
      height: 16px;
      color: var(--accent-primary);
      flex-shrink: 0;
      animation: track-row-pulse 1.2s ease-in-out infinite;
    }

    .audio-player__clear-queue-btn {
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      transition: all var(--transition-fast);
      min-height: var(--touch-target-min);
    }

    .audio-player__clear-queue-btn:hover {
      background-color: var(--color-hover);
      border-color: var(--border-secondary);
      color: var(--text-primary);
    }

    /* ========================================================================
       LYRICS TAB
       ======================================================================== */

    .audio-player__lyrics {
      height: 100%;
      overflow-y: auto;
      padding: var(--space-4);
      background-color: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .audio-player__lyrics-text {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--text-primary);
      white-space: pre-wrap;
      margin: 0;
    }

    /* ========================================================================
       EMPTY STATE
       ======================================================================== */

    .audio-player__empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-7) var(--space-4);
      text-align: center;
      color: var(--text-tertiary);
    }

    .audio-player__empty-state svg {
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }

    .audio-player__empty-state p {
      font-size: var(--text-sm);
      margin: 0;
    }

    /* ========================================================================
       RESPONSIVE
       ======================================================================== */

    @media (max-width: 768px) {
      .audio-player__mini-bar {
        padding: var(--space-2);
        gap: var(--space-1);
      }

      .audio-player__mini-artwork {
        width: 40px;
        height: 40px;
      }

      .audio-player__mini-title {
        font-size: var(--text-xs);
      }

      .audio-player__mini-artist {
        font-size: 10px;
      }

      .audio-player__mini-play-btn {
        width: 36px;
        height: 36px;
      }

      .audio-player__mini-play-btn svg {
        width: 18px;
        height: 18px;
      }

      .audio-player__mini-expand-btn {
        width: 28px;
        height: 28px;
      }

      .audio-player__mini-expand-btn svg {
        width: 18px;
        height: 18px;
      }

      .audio-player__mini-nav-btn {
        width: 30px;
        height: 30px;
      }

      .audio-player__mini-nav-btn svg {
        width: 18px;
        height: 18px;
      }

      .audio-player--expanded {
        height: 70vh;
        max-height: none;
      }

      .audio-player__artwork {
        width: 160px;
        height: 160px;
      }

      .audio-player__track-title {
        font-size: var(--text-lg);
      }

      .audio-player__control-btn {
        width: 40px;
        height: 40px;
      }

      .audio-player__control-btn svg {
        width: 20px;
        height: 20px;
      }

      .audio-player__control-btn--play {
        width: 56px;
        height: 56px;
      }

      .audio-player__control-btn--play svg {
        width: 28px;
        height: 28px;
      }

      .audio-player__header-shortcut-hint {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .audio-player__mini-progress {
        gap: var(--space-1);
      }

      .audio-player__time--remaining {
        display: none;
      }

      .audio-player__mini-artwork {
        width: 36px;
        height: 36px;
      }

      .audio-player__mini-info {
        flex: 1;
      }

      .audio-player__mini-expand-btn {
        display: none;
      }

      .audio-player__mini-auto-resume,
      .audio-player__mini-retry {
        display: none;
      }

      .audio-player__header {
        padding: var(--space-2) var(--space-3);
      }

      .audio-player__header-title {
        font-size: var(--text-base);
      }

      .audio-player__tabs {
        padding: var(--space-1) var(--space-2);
      }

      .audio-player__tab {
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-xs);
      }

      .audio-player__tab svg {
        width: 14px;
        height: 14px;
      }

      .audio-player__content {
        padding: var(--space-3);
      }

      .audio-player__artwork {
        width: 140px;
        height: 140px;
      }

      .audio-player__actions {
        flex-wrap: wrap;
        justify-content: center;
      }

      .audio-player__shortcut-hint {
        display: none;
      }
    }
  `],
})
export class AudioPlayerComponent {
  readonly audioPlayerService = inject(AudioPlayerService);
  readonly paymentService = inject(PaymentService);
  readonly authService = inject(AuthService);

  // ==========================================================================
  // SIGNALS
  // ==========================================================================

  /**
   * Current playback state from AudioPlayerService.
   */
  readonly isPlaying = computed(() => this.audioPlayerService.state().isPlaying);
  readonly isLoading = computed(() => this.audioPlayerService.state().isLoading);
  readonly isRetrying = computed(() => this.audioPlayerService.state().isRetrying);
  readonly autoResumed = computed(() => this.audioPlayerService.state().autoResumed);
  readonly currentTime = computed(() => this.audioPlayerService.state().currentTime);
  readonly duration = computed(() => this.audioPlayerService.state().duration);
  readonly currentTrackId = computed(() => this.audioPlayerService.state().currentTrackId);

  /**
   * Whether the user is currently scrubbing the seek bar.
   */
  readonly isSeeking = signal<boolean>(false);

  /**
   * Previewed seek position (seconds) while dragging, before commit.
   */
  readonly dragTime = signal<number | null>(null);

  /**
   * Current track from queue.
   */
  readonly currentTrack = computed(() => {
    const idx = this.audioPlayerService.currentIndex();
    const queue = this.audioPlayerService.queue();
    return idx >= 0 && idx < queue.length ? queue[idx] : null;
  });

  /**
   * Whether a track is selected for streaming.
   */
  readonly hasTrack = this.audioPlayerService.hasActiveTrack;

  /**
   * Playback queue.
   */
  readonly queue = this.audioPlayerService.queue;

  /**
   * Current queue index.
   */
  readonly currentIndex = this.audioPlayerService.currentIndex;

  /**
   * Player view state (mini or expanded).
   */
  readonly isExpanded = signal<boolean>(false);

  /**
   * Active tab in expanded state.
   */
  readonly activeTab = signal<PlayerTab>('now-playing');

  /**
   * Whether to show YouTube video.
   */
  readonly showYouTube = signal<boolean>(false);

  /**
   * Purchase state for the current track.
   */
  readonly isPurchased = signal<boolean>(false);
  readonly isPurchasePending = signal<boolean>(false);
  readonly purchaseError = signal<string | null>(null);
  readonly downloadUrl = signal<DownloadInfo | null>(null);

  /**
   * Purchase dialog state.
   */
  readonly dialogState = signal<PurchaseDialogState>('closed');
  readonly dialogSong = signal<Song | null>(null);
  readonly dialogError = signal<string>('');

  // ==========================================================================
  // COMPUTED SIGNALS
  // ==========================================================================

  /**
   * Time shown on the progress bar — previews the drag position while scrubbing.
   */
  readonly displayTime = computed(() => this.dragTime() ?? this.currentTime());

  /**
   * Progress percentage (0-100).
   */
  readonly progressPercent = computed(() => {
    const current = this.displayTime();
    const total = this.duration();
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.min(100, Math.max(0, (current / total) * 100));
  });

  /**
   * Remaining playback time (seconds).
   */
  readonly remainingTime = computed(() => Math.max(0, this.duration() - this.displayTime()));

  /**
   * YouTube embed URL.
   */
  readonly youtubeEmbedUrl = computed(() => {
    const videoId = this.currentTrack()?.youtubeVideoId;
    if (!videoId) return '';
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`;
  });

  /**
   * Whether previous track is available.
   */
  readonly canPlayPrevious = computed(() => {
    return this.audioPlayerService.currentIndex() > 0 || this.currentTime() > this.restartThresholdSeconds;
  });

  /**
   * Whether next track is available.
   */
  readonly canPlayNext = computed(() => {
    const idx = this.audioPlayerService.currentIndex();
    const queue = this.audioPlayerService.queue();
    return idx >= 0 && idx < queue.length - 1;
  });

  // ==========================================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================================

  /**
   * Handles global keyboard shortcuts for player control.
   * - Space: Toggle play/pause
   * - ArrowLeft: Play previous track
   * - ArrowRight: Play next track
   * 
   * Does not fire when focus is inside input/textarea elements or
   * when no track is loaded.
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (!this.hasTrack()) return;

    const target = event.target as HTMLElement;
    const isInput = target.matches('input, textarea, [contenteditable]');
    if (isInput) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.togglePlayPause(event);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.playPrevious();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.playNext();
        break;
    }
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handles mini bar click to expand.
   * Prevents expansion when clicking action buttons or the seek bar.
   */
  onMiniBarClick(event: Event): void {
    const target = event.target as HTMLElement;
    const isInteractive = target.closest('button, input, [role="slider"], a[href], a[ng-reflect-router-link]');
    if (!isInteractive) {
      this.expand(event);
    }
  }

  /**
   * Prevents the mini bar from expanding when a navigation link inside it is
   * clicked — the router handles the click and the player stays collapsed.
   */
  onMiniBarLinkClick(event: Event): void {
    event.stopPropagation();
  }

  /**
   * Handles keyboard activation of the mini bar (Enter/Space) to expand the player.
   */
  onMiniBarKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      event.preventDefault();
    }
    this.onMiniBarClick(event);
  }

  /**
   * Seconds to seek per Arrow key press.
   */
  private readonly seekStepSeconds = 5;

  /**
   * Seconds into a track before the Previous button restarts the current track
   * instead of jumping to the prior track (standard media-player behavior).
   */
  private readonly restartThresholdSeconds = 3;

  /**
   * Converts a pointer/client X coordinate to a seek time.
   * @private
   */
  private seekTimeFromPointer(event: MouseEvent | PointerEvent): number {
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    if (rect.width === 0) return 0;
    const ratio = (event.clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio)) * this.duration();
  }

  /**
   * Seeks to the clicked position on the progress bar.
   */
  onSeekBarClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.duration() <= 0) return;
    this.audioPlayerService.seek(this.seekTimeFromPointer(event));
  }

  /**
   * Starts a drag-to-seek gesture on the progress bar.
   */
  onSeekStart(event: PointerEvent): void {
    event.stopPropagation();
    if (this.duration() <= 0) return;
    this.isSeeking.set(true);
    this.dragTime.set(this.seekTimeFromPointer(event));
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture unavailable — the drag still tracks via move/up events.
    }
  }

  /**
   * Updates the seek preview while dragging.
   */
  onSeekMove(event: PointerEvent): void {
    event.stopPropagation();
    if (!this.isSeeking() || this.duration() <= 0) return;
    this.dragTime.set(this.seekTimeFromPointer(event));
  }

  /**
   * Commits the seek position when the drag gesture ends.
   */
  onSeekEnd(event: PointerEvent): void {
    event.stopPropagation();
    if (!this.isSeeking()) return;
    const targetTime = this.dragTime() ?? this.currentTime();
    this.audioPlayerService.seek(targetTime);
    this.isSeeking.set(false);
    this.dragTime.set(null);
    const target = event.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture was never acquired — nothing to release.
    }
  }

  /**
   * Handles keyboard seek on the focused progress bar.
   * - ArrowLeft/ArrowRight: seek backward/forward 5 seconds
   * - Home/End: seek to the start/end of the track
   */
  onSeekKeydown(event: KeyboardEvent): void {
    if (this.duration() <= 0) return;
    event.stopPropagation();

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.audioPlayerService.seek(Math.max(0, this.currentTime() - this.seekStepSeconds));
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.audioPlayerService.seek(Math.min(this.duration(), this.currentTime() + this.seekStepSeconds));
        break;
      case 'Home':
        event.preventDefault();
        this.audioPlayerService.seek(0);
        break;
      case 'End':
        event.preventDefault();
        this.audioPlayerService.seek(this.duration());
        break;
    }
  }

  /**
   * Expands the player to full view.
   */
  expand(event: Event): void {
    event.stopPropagation();
    this.isExpanded.set(true);
  }

  /**
   * Collapses the player to mini bar.
   */
  collapse(event: Event): void {
    event.stopPropagation();
    this.isExpanded.set(false);
  }

  /**
   * Sets the active tab.
   */
  setTab(tab: PlayerTab): void {
    this.activeTab.set(tab);
  }

  /**
   * Toggles play/pause.
   */
  togglePlayPause(event: Event): void {
    event.stopPropagation();
    if (this.isPlaying()) {
      this.audioPlayerService.pause();
    } else {
      this.audioPlayerService.resume();
    }
  }

  /**
   * Plays the previous track — or restarts the current one when it has been
   * playing past the restart threshold (standard media-player behavior).
   */
  playPrevious(): void {
    if (this.currentTime() > this.restartThresholdSeconds) {
      this.audioPlayerService.seek(0);
      return;
    }
    this.audioPlayerService.playPrevious();
  }

  /**
   * Plays the next track.
   */
  playNext(): void {
    this.audioPlayerService.playNext();
  }

  /**
   * Plays a track at the specified index in the queue.
   */
  playTrackAtIndex(index: number): void {
    const queue = this.audioPlayerService.queue();
    if (index >= 0 && index < queue.length) {
      this.audioPlayerService.currentIndex.set(index);
      this.audioPlayerService.playTrack(queue[index]);
    }
  }

  /**
   * Clears the playback queue.
   */
  clearQueue(): void {
    this.audioPlayerService.clearQueue();
  }

  /**
   * Toggles YouTube video visibility.
   */
  toggleYouTube(): void {
    this.showYouTube.update(v => !v);
  }

  /**
   * Shares the current track via WhatsApp.
   */
  shareTrack(): void {
    const track = this.currentTrack();
    if (!track) return;

    const text = encodeURIComponent(`Check out "${track.title}" by ${track.artist}`);
    const url = `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Checks purchase status when the track changes.
   * @private
   */
  private readonly checkPurchaseEffect = effect(() => {
    const track = this.currentTrack();
    const user = this.authService.currentUser();
    if (!track || !user) {
      this.isPurchased.set(false);
      this.downloadUrl.set(null);
      return;
    }
    this.paymentService.checkPurchaseStatus(track.id, user.userId).then(purchased => {
      this.isPurchased.set(purchased);
    });
  });

  /**
   * Collapses the player whenever the selected track is cleared.
   * @private
   */
  private readonly collapseWhenHiddenEffect = effect(() => {
    if (!this.hasTrack()) {
      this.isExpanded.set(false);
    }
  });

  /**
   * Handles download button click.
   * Shows purchase dialog for guests or non-purchasers, downloads directly if purchased.
   */
  onDownloadClick(): void {
    const track = this.currentTrack();
    if (!track) return;

    const user = this.authService.currentUser();
    if (!user) {
      // Guest — show sign-in dialog
      this.dialogSong.set(this.trackToSong(track));
      this.dialogError.set('');
      this.dialogState.set('guest');
      return;
    }

    if (this.isPurchased()) {
      this.downloadTrack();
      return;
    }

    if (!track.priceZAR || track.priceZAR <= 0) {
      this.dialogSong.set(this.trackToSong(track));
      this.dialogError.set('This track is not available for purchase.');
      this.dialogState.set('error');
      return;
    }

    // Logged in but not purchased — show purchase confirmation
    this.dialogSong.set(this.trackToSong(track));
    this.dialogError.set('');
    this.dialogState.set('confirm');
  }

  /**
   * Converts a Track to a Song for the purchase dialog.
   * @private
   */
  private trackToSong(track: Track): Song {
    return {
      songId: track.id,
      artistId: track.artistId,
      title: track.title,
      albumId: track.albumId,
      streamUrl: track.streamUrl,
      securePath: '',
      priceZAR: track.priceZAR ?? 0,
      minimumPriceZAR: track.minimumPriceZAR,
      duration: track.duration,
      artworkUrl: track.artworkUrl,
      lyrics: track.lyrics,
      youtubeVideoId: track.youtubeVideoId,
    };
  }

  /**
   * Closes the purchase dialog.
   */
  closeDialog(): void {
    this.dialogState.set('closed');
    this.dialogSong.set(null);
    this.dialogError.set('');
  }

  /**
   * Confirms the purchase from the dialog at the chosen amount.
   */
  async confirmPurchase(amount: number): Promise<void> {
    const track = this.currentTrack();
    const user = this.authService.currentUser();
    if (!track || !user) return;

    if (!track.priceZAR || track.priceZAR <= 0) {
      this.dialogError.set('This track is not available for purchase.');
      this.dialogState.set('error');
      return;
    }

    this.dialogState.set('purchasing');
    this.dialogError.set('');

    const result = await this.paymentService.initiateCheckout({
      songId: track.id,
      purchaseType: 'single',
      amountZAR: amount,
      userId: user.userId,
      artistId: track.artistId,
    });

    if (result.isSuccess()) {
      const purchaseResult = result.getData();
      if (purchaseResult.success) {
        this.isPurchased.set(true);
        this.dialogState.set('success');
        // Trigger download after successful purchase
        setTimeout(() => {
          this.downloadTrack();
          this.closeDialog();
        }, 1500);
      } else if (purchaseResult.error) {
        this.dialogError.set(purchaseResult.error);
        this.dialogState.set('error');
      }
    } else {
      this.dialogError.set(result.getError() || 'Purchase failed. Please try again.');
      this.dialogState.set('error');
    }
  }

  /**
   * Downloads the current track if purchased.
   */
  async downloadTrack(): Promise<void> {
    const track = this.currentTrack();
    const user = this.authService.currentUser();
    if (!track || !user) return;

    this.isPurchasePending.set(true);

    const result = await this.paymentService.getDownloadUrl(track.id, user.userId);
    if (result.isSuccess()) {
      const downloadInfo = result.getData();
      this.downloadUrl.set(downloadInfo);
      this.paymentService.triggerDownload(downloadInfo, `${track.title} - ${track.artist}.mp3`);
    } else {
      this.purchaseError.set(result.getError());
    }

    this.isPurchasePending.set(false);
  }

  /**
   * Dismisses the purchase error.
   */
  dismissPurchaseError(): void {
    this.purchaseError.set(null);
  }

  /**
   * Formats time in seconds to mm:ss display format.
   */
  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const safe = Math.floor(seconds);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
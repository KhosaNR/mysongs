import { Injectable, inject, signal, computed, effect, OnDestroy, DestroyRef } from '@angular/core';
import { ErrorHandler, Result } from '../utils/error-handler';
import { NetworkStatusService } from './network-status.service';

/**
 * Represents the current playback state.
 */
export interface PlaybackState {
  readonly isPlaying: boolean;
  readonly currentTrackId: string | null;
  readonly currentTrackUrl: string | null;
  readonly currentTime: number;
  readonly duration: number;
  readonly volume: number;
  readonly isMuted: boolean;
  readonly isLoading: boolean;
  readonly isRetrying: boolean;
  readonly autoResumed: boolean;
  readonly error: string | null;
}

/**
 * Represents a track in the playback queue.
 */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly artistId: string;
  readonly albumId?: string;
  readonly albumTitle?: string;
  readonly streamUrl: string;
  readonly artworkUrl?: string;
  readonly duration?: number;
  readonly youtubeVideoId?: string;
  readonly lyrics?: string;
  readonly featuredArtists?: string;
  readonly producers?: string;
  readonly writtenBy?: string;
  readonly priceZAR?: number;
  readonly minimumPriceZAR?: number;
}

/**
 * Repeat behaviour: stop at the queue end, loop the whole queue, or loop the
 * current track.
 */
export type RepeatMode = 'off' | 'all' | 'one';

const REPEAT_STORAGE_KEY = 'mysongs.player.repeatMode';
const SHUFFLE_STORAGE_KEY = 'mysongs.player.shuffled';

/** Reads the persisted repeat mode, defaulting to `off`. SSR-safe. */
function readStoredRepeatMode(): RepeatMode {
  if (typeof localStorage === 'undefined') {
    return 'off';
  }
  const stored = localStorage.getItem(REPEAT_STORAGE_KEY);
  return stored === 'all' || stored === 'one' ? stored : 'off';
}

/** Persists the repeat mode. SSR-safe. */
function persistRepeatMode(mode: RepeatMode): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(REPEAT_STORAGE_KEY, mode);
}

/** Persists the shuffle preference. SSR-safe. */
function persistShuffle(enabled: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(SHUFFLE_STORAGE_KEY, enabled ? '1' : '0');
}

/**
 * Service managing global persistent audio playback across route navigation.
 * 
 * Provides a route-safe audio player that survives page transitions.
 * Includes network-aware stall detection and auto-resume on reconnect.
 * 
 * @example
 * ```typescript
 * // Play a track
 * this.audioPlayerService.playTrack({
 *   id: 'track_101',
 *   title: 'Soweto Grooves',
 *   artist: 'Test Artist',
 *   streamUrl: 'https://pub-r2.dev/stream_101.mp3'
 * });
 * 
 * // Listen to playback state
 * this.audioPlayerService.state.subscribe(state => {
 *   console.log('Playing:', state.isPlaying);
 *   console.log('Current time:', state.currentTime);
 * });
 * 
 * // Control playback
 * this.audioPlayerService.pause();
 * this.audioPlayerService.resume();
 * this.audioPlayerService.setVolume(0.8);
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AudioPlayerService implements OnDestroy {
  private readonly errorHandler = inject(ErrorHandler);
  private readonly networkStatus = inject(NetworkStatusService);
  private readonly destroyRef = inject(DestroyRef);
  private audioElement: HTMLAudioElement | null = null;
  private timeUpdateInterval: number | null = null;
  private stallDetectionTimeout: number | null = null;
  private autoResumeTimeout: number | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  /**
   * Signal containing the current playback state.
   * Updates in real-time as playback progresses.
   */
  readonly state = signal<PlaybackState>({
    isPlaying: false,
    currentTrackId: null,
    currentTrackUrl: null,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    isMuted: false,
    isLoading: false,
    isRetrying: false,
    autoResumed: false,
    error: null,
  });

  /**
   * Signal containing the current playback queue.
   */
  readonly queue = signal<Track[]>([]);

  /**
   * Signal containing the current queue index.
   */
  readonly currentIndex = signal<number>(-1);

  /**
   * Repeat mode, cycling off → all → one. Persisted locally as a listener
   * device preference rather than Firestore user data.
   */
  readonly repeatMode = signal<RepeatMode>(readStoredRepeatMode());

  /** Whether queue navigation follows a shuffled order. */
  readonly isShuffled = signal<boolean>(false);

  /**
   * Shuffled playback order expressed as original queue indices.
   *
   * `null` when shuffle is inactive, in which case navigation is plain index
   * ± 1. The queue signal itself is never reshuffled, so metadata lookups by
   * `queue[currentIndex]` keep working unchanged.
   */
  private readonly shuffleOrder = signal<number[] | null>(null);

  /**
   * Queue entries in audible playback order.
   *
   * Consumers that display the queue must use this so the shown order always
   * matches what the listener will actually hear.
   */
  readonly playbackQueue = computed<Track[]>(() => {
    const queue = this.queue();
    const order = this.shuffleOrder();

    if (!order) {
      return queue;
    }

    const ordered = order
      .map((index) => queue[index])
      .filter((track): track is Track => track !== undefined);

    return ordered.length === queue.length ? ordered : queue;
  });

  /**
   * Whether a track is currently selected for streaming.
   *
   * True when a stream URL is loaded or a queue entry is selected.
   */
  readonly hasActiveTrack = computed(() => {
    const idx = this.currentIndex();
    const queue = this.queue();
    return this.state().currentTrackUrl !== null || (idx >= 0 && idx < queue.length);
  });

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeAudioElement();
      this.setupNetworkListeners();
      this.watchReconnect();
    }
  }

  /**
   * Initializes the HTML5 audio element with event listeners.
   * @private
   */
  private initializeAudioElement(): void {
    this.audioElement = new Audio();
    this.audioElement.volume = this.state().volume;
    this.audioElement.preload = 'metadata';

    // Time update
    this.audioElement.addEventListener('timeupdate', () => {
      const current = this.audioElement?.currentTime ?? 0;
      this.state.update(s => ({
        ...s,
        currentTime: Number.isFinite(current) ? current : 0,
      }));
    });

    // Duration change
    this.audioElement.addEventListener('durationchange', () => {
      const duration = this.audioElement?.duration ?? 0;
      this.state.update(s => ({
        ...s,
        duration: Number.isFinite(duration) ? duration : 0,
      }));
    });

    // Track ended
    this.audioElement.addEventListener('ended', () => {
      void this.handleTrackEnded();
    });

    // Loading state
    this.audioElement.addEventListener('waiting', () => {
      this.state.update(s => ({ ...s, isLoading: true }));
      this.startStallDetection();
    });

    this.audioElement.addEventListener('canplay', () => {
      this.state.update(s => ({ ...s, isLoading: false, isRetrying: false }));
      this.stopStallDetection();
      // Media actually loaded — proof the network is reachable.
      this.networkStatus.reportNetworkSuccess();
    });

    // Playing state (clears retrying flag)
    this.audioElement.addEventListener('playing', () => {
      this.state.update(s => ({ ...s, isRetrying: false }));
    });

    // Error handling
    this.audioElement.addEventListener('error', () => {
      const error = this.audioElement?.error;
      let errorMessage = 'Audio playback failed.';

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Playback was aborted.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error during playback.';
            this.networkStatus.reportNetworkFailure();
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio decoding failed.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported.';
            break;
        }
      }

      this.state.update(s => ({ ...s, error: errorMessage, isLoading: false, isRetrying: false }));
      this.stopStallDetection();

      this.errorHandler.executeSync(
        () => {
          throw new Error(errorMessage);
        },
        'audioError',
        {
          trackId: this.state().currentTrackId,
          errorCode: error?.code,
        }
      );
    });

    // Play/Pause state
    this.audioElement.addEventListener('play', () => {
      this.state.update(s => ({ ...s, isPlaying: true, error: null }));
    });

    this.audioElement.addEventListener('pause', () => {
      this.state.update(s => ({ ...s, isPlaying: false }));
    });
  }

  /**
   * Sets up network status listeners for auto-resume.
   * @private
   */
  private setupNetworkListeners(): void {
    // Fallback: listen to raw online event as well
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        const currentState = this.state();
        if (currentState.currentTrackUrl && !currentState.isPlaying) {
          this.autoResumePlayback();
        }
      });
    }
  }

  /**
   * Watches the NetworkStatusService `wasOffline` signal to auto-resume
   * playback and notify the user when connectivity is restored.
   * @private
   */
  private watchReconnect(): void {
    effect(() => {
      if (this.networkStatus.wasOffline()) {
        const currentState = this.state();
        if (currentState.currentTrackUrl && !currentState.isPlaying) {
          this.autoResumePlayback();
        }
      }
    });
  }

  /**
   * Attempts to resume playback after a network reconnect and shows a
   * transient auto-resumed indicator.
   * @private
   */
  private autoResumePlayback(): void {
    this.state.update(s => ({ ...s, autoResumed: true }));
    this.resume();

    // Clear the autoResumed flag after 3 seconds
    this.autoResumeTimeout = window.setTimeout(() => {
      this.state.update(s => ({ ...s, autoResumed: false }));
      this.autoResumeTimeout = null;
    }, 3000);
  }

  /**
   * Starts stall detection timeout.
   * If audio stalls for more than 5 seconds, attempts to recover.
   * @private
   */
  private startStallDetection(): void {
    this.stopStallDetection();
    
    this.stallDetectionTimeout = window.setTimeout(() => {
      const currentState = this.state();
      if (currentState.isLoading && currentState.currentTrackUrl) {
        this.handleStall();
      }
    }, 5000);
  }

  /**
   * Stops stall detection timeout.
   * @private
   */
  private stopStallDetection(): void {
    if (this.stallDetectionTimeout !== null) {
      clearTimeout(this.stallDetectionTimeout);
      this.stallDetectionTimeout = null;
    }
  }

  /**
   * Handles audio stall by attempting to reload the track.
   * @private
   */
  private handleStall(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state.update(s => ({
        ...s,
        error: 'Playback stalled. Please try again.',
        isLoading: false,
        isRetrying: false,
      }));
      this.stopStallDetection();
      this.networkStatus.reportNetworkFailure();
      return;
    }

    this.reconnectAttempts++;
    this.state.update(s => ({ ...s, isRetrying: true }));
    const currentUrl = this.state().currentTrackUrl;
    const currentTime = this.audioElement?.currentTime || 0;

    if (currentUrl && this.audioElement) {
      this.audioElement.src = currentUrl;
      this.audioElement.currentTime = currentTime;
      this.audioElement.play().catch(() => {
        // Silently fail, will retry
      });
    }
  }

  /**
   * Plays a track immediately.
   * 
   * @param track - The track to play
   * @returns A Result indicating success or failure
   */
  async playTrack(track: Track): Promise<Result<void>> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    // The player UI resolves track metadata from queue[currentIndex], so the
    // played track must be synchronized into the queue — not just state.
    this.ensureTrackInQueue(track);

    this.state.update(s => ({ ...s, isLoading: true, isRetrying: false, error: null }));
    this.reconnectAttempts = 0;

    const result = await this.errorHandler.execute(
      async () => {
        this.audioElement!.src = track.streamUrl;
        this.audioElement!.load();
        
        await this.audioElement!.play();
        
        this.state.update(s => ({
          ...s,
          currentTrackId: track.id,
          currentTrackUrl: track.streamUrl,
          duration: track.duration || 0,
        }));
      },
      'playTrack',
      {
        trackId: track.id,
        trackTitle: track.title,
      }
    );

    this.state.update(s => ({ ...s, isLoading: false }));

    if (result.isFailure()) {
      this.state.update(s => ({ ...s, error: result.getError() }));
    }

    return result;
  }

  /**
   * Replaces the playback queue with the given tracks and starts playback at
   * the requested index.
   *
   * Used by album/playlist views to queue and play a full collection while
   * preserving the metadata the player UI resolves from `queue[currentIndex]`.
   *
   * @param tracks - Ordered tracks to enqueue
   * @param startIndex - Index within `tracks` to begin playback (default 0)
   * @returns A Result indicating success or failure
   */
  async playQueue(tracks: Track[], startIndex = 0): Promise<Result<void>> {
    if (tracks.length === 0) {
      return Result.failure('Nothing to play.');
    }

    const safeStart = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    this.queue.set([...tracks]);
    this.currentIndex.set(safeStart);
    if (this.isShuffled()) {
      this.shuffleOrder.set(this.buildShuffleOrder(tracks.length));
    }

    return this.playTrack(tracks[safeStart]);
  }

  /**
   * Ensures the given track is registered in the playback queue and selected.
   *
   * The player UI derives the current track's metadata from
   * `queue[currentIndex]`, so tracks played directly (e.g. from the Explore
   * page) must also be synchronized into the queue. Tracks already selected at
   * the current index are left untouched (covers next/previous/jump flows);
   * tracks queued elsewhere are re-selected in place to avoid duplicates;
   * otherwise the track is appended and selected.
   *
   * @param track - The track about to be played
   * @private
   */
  private ensureTrackInQueue(track: Track): void {
    const currentQueue = this.queue();
    const currentIdx = this.currentIndex();

    if (currentIdx >= 0 && currentIdx < currentQueue.length && currentQueue[currentIdx].id === track.id) {
      return;
    }

    const existingIdx = currentQueue.findIndex(t => t.id === track.id);
    if (existingIdx >= 0) {
      this.currentIndex.set(existingIdx);
      return;
    }

    this.queue.update(q => [...q, track]);
    this.currentIndex.set(this.queue().length - 1);
  }

  /**
   * Pauses the current track.
   * 
   * @returns A Result indicating success or failure
   */
  pause(): Result<void> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    try {
      this.audioElement.pause();
      return Result.success(undefined);
    } catch (error) {
      this.errorHandler.executeSync(
        () => {
          throw error;
        },
        'pause'
      );
      return Result.failure('Failed to pause playback.');
    }
  }

  /**
   * Resumes playback of the current track.
   * 
   * @returns A Result indicating success or failure
   */
  async resume(): Promise<Result<void>> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    const result = await this.errorHandler.execute(
      async () => {
        await this.audioElement!.play();
      },
      'resume'
    );

    if (result.isFailure()) {
      this.state.update(s => ({ ...s, error: result.getError() }));
    }

    return result;
  }

  /**
   * Stops playback and clears the current track.
   * 
   * @returns A Result indicating success or failure
   */
  stop(): Result<void> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    try {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.src = '';
      
      this.state.set({
        isPlaying: false,
        currentTrackId: null,
        currentTrackUrl: null,
        currentTime: 0,
        duration: 0,
        volume: this.state().volume,
        isMuted: this.state().isMuted,
        isLoading: false,
        isRetrying: false,
        autoResumed: false,
        error: null,
      });

      return Result.success(undefined);
    } catch (error) {
      this.errorHandler.executeSync(
        () => {
          throw error;
        },
        'stop'
      );
      return Result.failure('Failed to stop playback.');
    }
  }

  /**
   * Seeks to a specific time in the current track.
   * 
   * @param time - The time in seconds to seek to
   * @returns A Result indicating success or failure
   */
  seek(time: number): Result<void> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    try {
      this.audioElement.currentTime = time;
      return Result.success(undefined);
    } catch (error) {
      this.errorHandler.executeSync(
        () => {
          throw error;
        },
        'seek',
        { time }
      );
      return Result.failure('Failed to seek.');
    }
  }

  /**
   * Sets the playback volume.
   * 
   * @param volume - The volume level (0.0 to 1.0)
   * @returns A Result indicating success or failure
   */
  setVolume(volume: number): Result<void> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    const clampedVolume = Math.max(0, Math.min(1, volume));

    try {
      this.audioElement.volume = clampedVolume;
      this.state.update(s => ({ ...s, volume: clampedVolume }));
      return Result.success(undefined);
    } catch (error) {
      this.errorHandler.executeSync(
        () => {
          throw error;
        },
        'setVolume',
        { volume: clampedVolume }
      );
      return Result.failure('Failed to set volume.');
    }
  }

  /**
   * Toggles mute state.
   * 
   * @returns A Result indicating success or failure
   */
  toggleMute(): Result<void> {
    if (!this.audioElement) {
      return Result.failure('Audio player not initialized.');
    }

    try {
      this.audioElement.muted = !this.audioElement.muted;
      this.state.update(s => ({ ...s, isMuted: this.audioElement!.muted }));
      return Result.success(undefined);
    } catch (error) {
      this.errorHandler.executeSync(
        () => {
          throw error;
        },
        'toggleMute'
      );
      return Result.failure('Failed to toggle mute.');
    }
  }

  /**
   * Advances the repeat mode through off → all → one.
   */
  cycleRepeatMode(): void {
    const cycle: readonly RepeatMode[] = ['off', 'all', 'one'];
    const next = cycle[(cycle.indexOf(this.repeatMode()) + 1) % cycle.length];
    this.repeatMode.set(next);
    persistRepeatMode(next);
  }

  /**
   * Toggles shuffled queue navigation.
   *
   * Enabling builds a fresh Fisher-Yates order anchored on the currently
   * playing track so playback continues uninterrupted; disabling restores
   * sequential navigation.
   */
  toggleShuffle(): void {
    const next = !this.isShuffled();
    this.isShuffled.set(next);
    this.shuffleOrder.set(next ? this.buildShuffleOrder(this.queue().length) : null);
    persistShuffle(next);
  }

  /**
   * Builds a shuffled order of queue indices, keeping the active track first.
   *
   * @param length - Queue length to permute
   * @returns Original queue indices in playback order
   */
  private buildShuffleOrder(length: number): number[] {
    const active = this.currentIndex();
    const remaining: number[] = [];

    for (let i = 0; i < length; i++) {
      if (i !== active) {
        remaining.push(i);
      }
    }

    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    return active >= 0 && active < length ? [active, ...remaining] : remaining;
  }

  /**
   * Resolves the queue index to navigate to, honouring shuffle order and
   * wrapping at the boundaries when `repeat: 'all'` is active.
   *
   * @param currentIdx - Index currently playing
   * @param direction - 1 to advance, -1 to go back
   * @returns The target queue index, or `null` when the queue edge is reached
   */
  private resolveNeighbour(currentIdx: number, direction: 1 | -1): number | null {
    const queue = this.queue();
    const last = queue.length - 1;
    if (last < 0) {
      return null;
    }

    const wraps = this.repeatMode() === 'all';
    const order = this.shuffleOrder();

    if (order && order.length === queue.length) {
      const position = order.indexOf(currentIdx);
      if (position !== -1) {
        const target = position + direction;
        if (target >= 0 && target < order.length) {
          return order[target];
        }
        return wraps ? (direction === 1 ? order[0] : order[order.length - 1]) : null;
      }
    }

    const target = currentIdx + direction;
    if (target >= 0 && target <= last) {
      return target;
    }
    return wraps ? (direction === 1 ? 0 : last) : null;
  }

  /**
   * Handles a track reaching its end.
   *
   * `repeat: 'one'` restarts the same track; otherwise playback advances via
   * {@link playNext}, which applies shuffle order and `repeat: 'all'` wrapping.
   */
  private async handleTrackEnded(): Promise<void> {
    if (this.repeatMode() === 'one') {
      const element = this.audioElement;
      if (!element) {
        return;
      }
      try {
        element.currentTime = 0;
        await element.play();
      } catch (error) {
        this.errorHandler.executeSync(
          () => {
            throw error;
          },
          'handleTrackEnded',
        );
      }
      return;
    }

    await this.playNext();
  }

  /**
   * Whether a neighbour track exists in the given direction.
   *
   * Reads the queue and playback-mode signals, so callers may invoke it from
   * inside a `computed()` to stay reactive.
   *
   * @param direction - 1 to check forward, -1 to check backward
   * @returns Whether navigation is possible
   */
  canNavigate(direction: 1 | -1): boolean {
    return this.resolveNeighbour(this.currentIndex(), direction) !== null;
  }

  /**
   * Plays the next track in the queue.
   *
   * @returns A Result indicating success or failure
   */
  async playNext(): Promise<Result<void>> {
    if (this.queue().length === 0) {
      return Result.failure('Queue is empty.');
    }

    const nextIndex = this.resolveNeighbour(this.currentIndex(), 1);
    if (nextIndex === null) {
      return Result.failure('No next track in queue.');
    }

    this.currentIndex.set(nextIndex);
    return this.playTrack(this.queue()[nextIndex]);
  }

  /**
   * Plays the previous track in the queue.
   *
   * @returns A Result indicating success or failure
   */
  async playPrevious(): Promise<Result<void>> {
    if (this.queue().length === 0) {
      return Result.failure('Queue is empty.');
    }

    const prevIndex = this.resolveNeighbour(this.currentIndex(), -1);
    if (prevIndex === null) {
      return Result.failure('No previous track in queue.');
    }

    this.currentIndex.set(prevIndex);
    return this.playTrack(this.queue()[prevIndex]);
  }

  /**
   * Adds a track to the queue.
   * 
   * @param track - The track to add
   */
  addToQueue(track: Track): void {
    this.queue.update(q => [...q, track]);
  }

  /**
   * Clears the playback queue.
   */
  clearQueue(): void {
    this.queue.set([]);
    this.currentIndex.set(-1);
  }

  /**
   * Clears the current error message.
   */
  clearError(): void {
    this.state.update(s => ({ ...s, error: null }));
  }

  /**
   * Cleans up resources when the service is destroyed.
   */
  ngOnDestroy(): void {
    this.stopStallDetection();
    
    if (this.autoResumeTimeout !== null) {
      clearTimeout(this.autoResumeTimeout);
      this.autoResumeTimeout = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }
}
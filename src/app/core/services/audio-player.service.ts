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
  readonly priceZAR?: number;
  readonly minimumPriceZAR?: number;
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
      this.playNext();
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
   * Plays the next track in the queue.
   * 
   * @returns A Result indicating success or failure
   */
  async playNext(): Promise<Result<void>> {
    const currentQueue = this.queue();
    const currentIdx = this.currentIndex();

    if (currentQueue.length === 0 || currentIdx >= currentQueue.length - 1) {
      return Result.failure('No next track in queue.');
    }

    const nextIndex = currentIdx + 1;
    this.currentIndex.set(nextIndex);
    return this.playTrack(currentQueue[nextIndex]);
  }

  /**
   * Plays the previous track in the queue.
   * 
   * @returns A Result indicating success or failure
   */
  async playPrevious(): Promise<Result<void>> {
    const currentQueue = this.queue();
    const currentIdx = this.currentIndex();

    if (currentQueue.length === 0 || currentIdx <= 0) {
      return Result.failure('No previous track in queue.');
    }

    const prevIndex = currentIdx - 1;
    this.currentIndex.set(prevIndex);
    return this.playTrack(currentQueue[prevIndex]);
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
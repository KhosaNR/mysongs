import { Injectable, inject, signal, effect, OnDestroy } from '@angular/core';
import { ErrorHandler, Result } from '../utils/error-handler';

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
  readonly error: string | null;
}

/**
 * Represents a track in the playback queue.
 */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly streamUrl: string;
  readonly duration?: number;
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
 *   artist: 'Leo Bee',
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
  private audioElement: HTMLAudioElement | null = null;
  private timeUpdateInterval: number | null = null;
  private stallDetectionTimeout: number | null = null;
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

  constructor() {
    this.initializeAudioElement();
    this.setupNetworkListeners();
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
      this.state.update(s => ({
        ...s,
        currentTime: this.audioElement?.currentTime || 0,
      }));
    });

    // Duration change
    this.audioElement.addEventListener('durationchange', () => {
      this.state.update(s => ({
        ...s,
        duration: this.audioElement?.duration || 0,
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
      this.state.update(s => ({ ...s, isLoading: false }));
      this.stopStallDetection();
    });

    // Error handling
    this.audioElement.addEventListener('error', (event) => {
      const error = this.audioElement?.error;
      let errorMessage = 'Audio playback failed.';

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Playback was aborted.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error during playback.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio decoding failed.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported.';
            break;
        }
      }

      this.state.update(s => ({ ...s, error: errorMessage, isLoading: false }));
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
    // Listen to online event to resume playback
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        const currentState = this.state();
        if (currentState.currentTrackUrl && !currentState.isPlaying) {
          this.resume();
        }
      });
    }
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
      }));
      this.stopStallDetection();
      return;
    }

    this.reconnectAttempts++;
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

    this.state.update(s => ({ ...s, isLoading: true, error: null }));
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
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }
}
/**
 * Unit tests for AudioPlayerService.
 *
 * Focuses on playback queue synchronization: the player UI derives track
 * metadata from `queue[currentIndex]`, so `playTrack()` must register the
 * played track in the queue (regression test for "song plays but the track
 * info is not populated").
 */
import { TestBed } from '@angular/core/testing';
import { AudioPlayerService, Track } from './audio-player.service';

describe('AudioPlayerService', () => {
  let service: AudioPlayerService;

  const trackA: Track = {
    id: 'track_a',
    title: 'Track A',
    artist: 'Test Artist',
    artistId: 'artist_01',
    streamUrl: 'https://example.com/track_a.mp3',
  };

  const trackB: Track = {
    id: 'track_b',
    title: 'Track B',
    artist: 'Test Artist',
    artistId: 'artist_01',
    streamUrl: 'https://example.com/track_b.mp3',
  };

  beforeEach(() => {
    // jsdom's media element stubs cannot actually stream; make playback a
    // deterministic no-op so these tests focus on queue synchronization.
    const mediaProto = HTMLMediaElement.prototype;
    if (typeof mediaProto.play === 'function') {
      vi.spyOn(mediaProto, 'play').mockResolvedValue(undefined);
    }
    if (typeof mediaProto.load === 'function') {
      vi.spyOn(mediaProto, 'load').mockImplementation(() => undefined);
    }

    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioPlayerService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('playTrack()', () => {
    it('should register a played track in the queue and select it', async () => {
      const result = await service.playTrack(trackA);

      expect(result.isSuccess()).toBe(true);
      expect(service.state().currentTrackId).toBe(trackA.id);
      expect(service.queue()).toEqual([trackA]);
      expect(service.currentIndex()).toBe(0);
      expect(service.queue()[service.currentIndex()].id).toBe(trackA.id);
      expect(service.hasActiveTrack()).toBe(true);
    });

    it('should append and select a new track when the queue already has entries', async () => {
      await service.playTrack(trackA);
      await service.playTrack(trackB);

      expect(service.queue()).toEqual([trackA, trackB]);
      expect(service.currentIndex()).toBe(1);
    });

    it('should re-select an already queued track without duplicating it', async () => {
      await service.playTrack(trackA);
      await service.playTrack(trackB);
      await service.playTrack(trackA);

      expect(service.queue()).toEqual([trackA, trackB]);
      expect(service.currentIndex()).toBe(0);
    });

    it('should leave the queue unchanged when the selected track is replayed', async () => {
      await service.playTrack(trackA);
      await service.playTrack(trackA);

      expect(service.queue()).toEqual([trackA]);
      expect(service.currentIndex()).toBe(0);
    });

    it('should not touch the queue when playback cannot start', async () => {
      // Simulate an SSR / uninitialized player (no audio element).
      const holder = service as unknown as { audioElement: HTMLAudioElement | null };
      const originalAudio = holder.audioElement;
      holder.audioElement = null;

      const result = await service.playTrack(trackA);

      expect(result.isFailure()).toBe(true);
      expect(service.queue()).toEqual([]);
      expect(service.currentIndex()).toBe(-1);

      holder.audioElement = originalAudio;
    });
  });

  describe('duration/time sanitization', () => {
    function audioElement(): HTMLAudioElement {
      const holder = service as unknown as { audioElement: HTMLAudioElement | null };
      return holder.audioElement as HTMLAudioElement;
    }

    it('should store a finite duration reported by the browser', () => {
      const el = audioElement();
      Object.defineProperty(el, 'duration', { value: 265, configurable: true });
      el.dispatchEvent(new Event('durationchange'));

      expect(service.state().duration).toBe(265);
    });

    it('should clamp an Infinity duration to 0 (streams without Content-Length)', () => {
      const el = audioElement();
      Object.defineProperty(el, 'duration', { value: Infinity, configurable: true });
      el.dispatchEvent(new Event('durationchange'));

      expect(service.state().duration).toBe(0);
    });

    it('should clamp a NaN duration to 0', () => {
      const el = audioElement();
      Object.defineProperty(el, 'duration', { value: NaN, configurable: true });
      el.dispatchEvent(new Event('durationchange'));

      expect(service.state().duration).toBe(0);
    });

    it('should clamp a non-finite currentTime to 0', () => {
      const el = audioElement();
      Object.defineProperty(el, 'currentTime', { value: Infinity, configurable: true });
      el.dispatchEvent(new Event('timeupdate'));

      expect(service.state().currentTime).toBe(0);
    });
  });

  describe('playback modes', () => {
    const trackC: Track = {
      id: 'track_c',
      title: 'Track C',
      artist: 'Test Artist',
      artistId: 'artist_01',
      streamUrl: 'https://example.com/track_c.mp3',
    };

    function seedQueue(): void {
      service.queue.set([trackA, trackB, trackC]);
    }

    it('should cycle the repeat mode through off, all, one', () => {
      service.repeatMode.set('off');

      service.cycleRepeatMode();
      expect(service.repeatMode()).toBe('all');

      service.cycleRepeatMode();
      expect(service.repeatMode()).toBe('one');

      service.cycleRepeatMode();
      expect(service.repeatMode()).toBe('off');
    });

    it('should report no next track at the queue end when repeat is off', () => {
      seedQueue();
      service.currentIndex.set(2);
      service.repeatMode.set('off');

      expect(service.canNavigate(1)).toBe(false);
    });

    it('should wrap forward at the queue end when repeat is all', () => {
      seedQueue();
      service.currentIndex.set(2);
      service.repeatMode.set('all');

      expect(service.canNavigate(1)).toBe(true);
    });

    it('should wrap backward at the queue start when repeat is all', () => {
      seedQueue();
      service.currentIndex.set(0);
      service.repeatMode.set('all');

      expect(service.canNavigate(-1)).toBe(true);
    });

    it('should advance to the next track when next is clicked', async () => {
      seedQueue();
      service.currentIndex.set(0);
      service.repeatMode.set('off');

      const result = await service.playNext();

      expect(result.isSuccess()).toBe(true);
      expect(service.currentIndex()).toBe(1);
    });

    it('should leave the queue signal untouched while shuffling', () => {
      seedQueue();
      service.currentIndex.set(1);
      service.toggleShuffle();

      expect(service.isShuffled()).toBe(true);
      expect(service.queue().map((t) => t.id)).toEqual(['track_a', 'track_b', 'track_c']);
      expect(service.playbackQueue().map((t) => t.id).sort()).toEqual([
        'track_a',
        'track_b',
        'track_c',
      ]);
    });

    it('should keep the active track first in the shuffled playback order', () => {
      seedQueue();
      service.currentIndex.set(2);
      service.toggleShuffle();

      expect(service.playbackQueue()[0].id).toBe('track_c');
    });

    it('should navigate the full shuffled order before repeating', async () => {
      seedQueue();
      service.currentIndex.set(0);
      service.toggleShuffle();
      service.repeatMode.set('off');

      const visited = new Set<string>([service.playbackQueue()[0].id]);
      for (let step = 0; step < 2; step++) {
        await service.playNext();
        visited.add(service.currentIndex() >= 0 ? service.queue()[service.currentIndex()].id : '');
      }

      expect(visited.size).toBe(3);
    });

    it('should restore sequential playback order when shuffle is disabled', () => {
      seedQueue();
      service.toggleShuffle();
      service.toggleShuffle();

      expect(service.isShuffled()).toBe(false);
      expect(service.playbackQueue().map((t) => t.id)).toEqual([
        'track_a',
        'track_b',
        'track_c',
      ]);
    });

    it('should restart the current track when repeat is one and it ends', async () => {
      seedQueue();
      service.currentIndex.set(1);
      service.repeatMode.set('one');

      const el = service as unknown as { audioElement: HTMLAudioElement | null };
      el.audioElement?.dispatchEvent(new Event('ended'));
      await Promise.resolve();

      expect(service.currentIndex()).toBe(1);
    });
  });
});

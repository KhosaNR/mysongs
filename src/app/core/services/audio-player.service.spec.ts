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
});

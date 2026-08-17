import { AudioPlayerComponent } from './audio-player.component';
import { AudioPlayerService } from '../../../core/services/audio-player.service';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentService } from '../../../core/services/payment.service';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;
  let service: AudioPlayerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioPlayerComponent],
      providers: [
        AudioPlayerService,
        provideHttpClient(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: signal(null) } as unknown as AuthService,
        },
        {
          provide: PaymentService,
          useValue: {
            checkPurchaseStatus: () => Promise.resolve(false),
            initiateCheckout: () => Promise.resolve(undefined),
            getDownloadUrl: () => Promise.resolve(undefined),
            triggerDownload: () => undefined,
          } as unknown as PaymentService,
        },
      ],
    }).compileComponents();

    service = TestBed.inject(AudioPlayerService);
    component = TestBed.createComponent(AudioPlayerComponent).componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with collapsed state', () => {
      expect(component.isExpanded()).toBe(false);
    });

    it('should initialize with now-playing tab active', () => {
      expect(component.activeTab()).toBe('now-playing');
    });

    it('should initialize with YouTube hidden', () => {
      expect(component.showYouTube()).toBe(false);
    });

    it('should have no track playing initially', () => {
      expect(component.currentTrack()).toBeNull();
      expect(component.isPlaying()).toBe(false);
    });
  });

  describe('expand/collapse', () => {
    it('should expand when expand is called', () => {
      const event = new Event('click');
      component.expand(event);
      expect(component.isExpanded()).toBe(true);
    });

    it('should collapse when collapse is called', () => {
      component.isExpanded.set(true);
      const event = new Event('click');
      component.collapse(event);
      expect(component.isExpanded()).toBe(false);
    });

    it('should expand when mini bar is clicked (not on button)', () => {
      const target = document.createElement('div');
      const event = new Event('click');
      Object.defineProperty(event, 'target', { value: target });

      component.onMiniBarClick(event);
      expect(component.isExpanded()).toBe(true);
    });

    it('should not expand when button is clicked', () => {
      const button = document.createElement('button');
      const event = new Event('click');
      Object.defineProperty(event, 'target', { value: button });
      
      component.onMiniBarClick(event);
      expect(component.isExpanded()).toBe(false);
    });
  });

  describe('tab navigation', () => {
    it('should switch to playlist tab', () => {
      component.setTab('playlist');
      expect(component.activeTab()).toBe('playlist');
    });

    it('should switch to lyrics tab', () => {
      component.setTab('lyrics');
      expect(component.activeTab()).toBe('lyrics');
    });

    it('should switch back to now-playing tab', () => {
      component.setTab('playlist');
      component.setTab('now-playing');
      expect(component.activeTab()).toBe('now-playing');
    });
  });

  describe('playback controls', () => {
    it('should toggle play/pause', () => {
      const playSpy = vi.spyOn(service, 'resume');
      const pauseSpy = vi.spyOn(service, 'pause');

      // Initially not playing
      component.togglePlayPause(new Event('click'));
      expect(playSpy).toHaveBeenCalled();

      // Simulate playing
      service.state.set({ ...service.state(), isPlaying: true });
      
      component.togglePlayPause(new Event('click'));
      expect(pauseSpy).toHaveBeenCalled();
    });

    it('should play next track', () => {
      const playNextSpy = vi.spyOn(service, 'playNext');
      component.playNext();
      expect(playNextSpy).toHaveBeenCalled();
    });

    it('should play previous track', () => {
      const playPrevSpy = vi.spyOn(service, 'playPrevious');
      component.playPrevious();
      expect(playPrevSpy).toHaveBeenCalled();
    });

    it('should restart the current track when playing past the threshold', () => {
      service.state.set({ ...service.state(), currentTime: 10 });
      const seekSpy = vi.spyOn(service, 'seek').mockReturnValue({ isSuccess: () => true } as never);
      const playPrevSpy = vi.spyOn(service, 'playPrevious');

      component.playPrevious();

      expect(seekSpy).toHaveBeenCalledWith(0);
      expect(playPrevSpy).not.toHaveBeenCalled();
    });

    it('should play the previous track when near the start', () => {
      service.state.set({ ...service.state(), currentTime: 1 });
      const seekSpy = vi.spyOn(service, 'seek');
      const playPrevSpy = vi.spyOn(service, 'playPrevious');

      component.playPrevious();

      expect(seekSpy).not.toHaveBeenCalled();
      expect(playPrevSpy).toHaveBeenCalled();
    });

    it('should clear queue', () => {
      const clearQueueSpy = vi.spyOn(service, 'clearQueue');
      component.clearQueue();
      expect(clearQueueSpy).toHaveBeenCalled();
    });
  });

  describe('YouTube toggle', () => {
    it('should toggle YouTube visibility', () => {
      expect(component.showYouTube()).toBe(false);
      component.toggleYouTube();
      expect(component.showYouTube()).toBe(true);
      component.toggleYouTube();
      expect(component.showYouTube()).toBe(false);
    });
  });

  describe('share functionality', () => {
    it('should open WhatsApp share URL', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      
      // Mock current track
      service.queue.set([{
        id: 'track_1',
        title: 'Test Song',
        artist: 'Test Artist',
        artistId: 'artist_1',
        streamUrl: 'https://example.com/stream.mp3',
      }]);
      service.currentIndex.set(0);

      component.shareTrack();
      
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/?text=Check%20out%20%22Test%20Song%22%20by%20Test%20Artist',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should not share if no track is playing', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      component.shareTrack();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });

  describe('time formatting', () => {
    it('should format seconds to mm:ss', () => {
      expect(component.formatTime(0)).toBe('0:00');
      expect(component.formatTime(65)).toBe('1:05');
      expect(component.formatTime(125)).toBe('2:05');
      expect(component.formatTime(3661)).toBe('61:01');
    });

    it('should handle NaN', () => {
      expect(component.formatTime(NaN)).toBe('0:00');
    });

    it('should handle Infinity', () => {
      expect(component.formatTime(Infinity)).toBe('0:00');
    });

    it('should handle negative values', () => {
      expect(component.formatTime(-30)).toBe('0:00');
    });
  });

  describe('computed signals', () => {
    it('should calculate progress percentage', () => {
      service.state.set({
        ...service.state(),
        currentTime: 30,
        duration: 120,
      });
      
      expect(component.progressPercent()).toBe(25);
    });

    it('should return 0 progress when duration is 0', () => {
      service.state.set({
        ...service.state(),
        currentTime: 0,
        duration: 0,
      });
      
      expect(component.progressPercent()).toBe(0);
    });

    it('should calculate remaining time', () => {
      service.state.set({
        ...service.state(),
        currentTime: 30,
        duration: 120,
      });
      expect(component.remainingTime()).toBe(90);
    });

    it('should not go below zero for remaining time', () => {
      service.state.set({
        ...service.state(),
        currentTime: 150,
        duration: 120,
      });
      expect(component.remainingTime()).toBe(0);
    });

    it('should preview the drag position in display time and progress', () => {
      service.state.set({
        ...service.state(),
        currentTime: 30,
        duration: 120,
      });
      component.dragTime.set(40);

      expect(component.displayTime()).toBe(40);
      expect(component.progressPercent()).toBeCloseTo(33.33);
    });

    it('should generate YouTube embed URL', () => {
      service.queue.set([{
        id: 'track_1',
        title: 'Test Song',
        artist: 'Test Artist',
        artistId: 'artist_1',
        streamUrl: 'https://example.com/stream.mp3',
        youtubeVideoId: 'dQw4w9WgXcQ',
      }]);
      service.currentIndex.set(0);

      expect(component.youtubeEmbedUrl()).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0'
      );
    });

    it('should return empty string for YouTube URL when no video ID', () => {
      service.queue.set([{
        id: 'track_1',
        title: 'Test Song',
        artist: 'Test Artist',
        artistId: 'artist_1',
        streamUrl: 'https://example.com/stream.mp3',
      }]);
      service.currentIndex.set(0);

      expect(component.youtubeEmbedUrl()).toBe('');
    });

    it('should determine if previous track is available', () => {
      service.currentIndex.set(0);
      expect(component.canPlayPrevious()).toBe(false);

      service.currentIndex.set(2);
      expect(component.canPlayPrevious()).toBe(true);
    });

    it('should enable previous to restart the current track when playing', () => {
      service.currentIndex.set(0);
      service.state.set({ ...service.state(), currentTime: 10 });

      expect(component.canPlayPrevious()).toBe(true);
    });

    it('should determine if next track is available', () => {
      service.queue.set([
        { id: '1', title: 'Track 1', artist: 'Artist', artistId: 'a1', streamUrl: 'url1' },
        { id: '2', title: 'Track 2', artist: 'Artist', artistId: 'a1', streamUrl: 'url2' },
      ]);
      service.currentIndex.set(0);
      
      expect(component.canPlayNext()).toBe(true);

      service.currentIndex.set(1);
      expect(component.canPlayNext()).toBe(false);
    });
  });

  describe('queue management', () => {
    it('should play track at specific index', () => {
      const tracks = [
        { id: '1', title: 'Track 1', artist: 'Artist', artistId: 'a1', streamUrl: 'url1' },
        { id: '2', title: 'Track 2', artist: 'Artist', artistId: 'a1', streamUrl: 'url2' },
      ];
      
      service.queue.set(tracks);
      const playTrackSpy = vi.spyOn(service, 'playTrack').mockReturnValue({ isSuccess: () => true } as any);

      component.playTrackAtIndex(1);
      
      expect(service.currentIndex()).toBe(1);
      expect(playTrackSpy).toHaveBeenCalledWith(tracks[1]);
    });

    it('should not play track at invalid index', () => {
      service.queue.set([
        { id: '1', title: 'Track 1', artist: 'Artist', artistId: 'a1', streamUrl: 'url1' },
      ]);
      const playTrackSpy = vi.spyOn(service, 'playTrack');

      component.playTrackAtIndex(-1);
      component.playTrackAtIndex(5);
      
      expect(playTrackSpy).not.toHaveBeenCalled();
    });
  });

  describe('visibility', () => {
    it('should be hidden when no track is selected', () => {
      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement;
      expect(component.hasTrack()).toBe(false);
      expect(element.querySelector('.audio-player')).toBeNull();
    });

    it('should be visible when a stream URL is loaded', () => {
      service.state.update(s => ({ ...s, currentTrackUrl: 'https://example.com/stream.mp3' }));

      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement;
      expect(component.hasTrack()).toBe(true);
      expect(element.querySelector('.audio-player')).not.toBeNull();
    });

    it('should be visible when a queue entry is selected', () => {
      service.queue.set([{
        id: '1',
        title: 'Track 1',
        artist: 'Artist',
        artistId: 'a1',
        streamUrl: 'url1',
      }]);
      service.currentIndex.set(0);

      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      expect(component.hasTrack()).toBe(true);
      expect(fixture.nativeElement.querySelector('.audio-player')).not.toBeNull();
    });
  });

  describe('seek controls', () => {
    function mockSeekBar(): HTMLElement {
      const bar = document.createElement('div');
      vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 200,
        top: 0,
        bottom: 6,
        width: 200,
        height: 6,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      return bar;
    }

    function defineCurrentTarget(event: Event, target: EventTarget): Event {
      Object.defineProperty(event, 'currentTarget', { value: target });
      return event;
    }

    it('should seek to the clicked position', () => {
      service.state.set({ ...service.state(), currentTime: 10, duration: 100 });
      const seekSpy = vi.spyOn(service, 'seek').mockReturnValue({ isSuccess: () => true } as never);

      const event = defineCurrentTarget(new MouseEvent('click', { clientX: 50, bubbles: true }), mockSeekBar());
      component.onSeekBarClick(event as MouseEvent);

      expect(seekSpy).toHaveBeenCalledWith(25);
    });

    it('should not seek when duration is unknown', () => {
      service.state.set({ ...service.state(), currentTime: 0, duration: 0 });
      const seekSpy = vi.spyOn(service, 'seek');

      const event = defineCurrentTarget(new MouseEvent('click', { clientX: 50 }), mockSeekBar());
      component.onSeekBarClick(event as MouseEvent);

      expect(seekSpy).not.toHaveBeenCalled();
    });

    it('should preview position while dragging and commit on release', () => {
      service.state.set({ ...service.state(), duration: 100 });
      const seekSpy = vi.spyOn(service, 'seek').mockReturnValue({ isSuccess: () => true } as never);
      const bar = mockSeekBar();

      const down = defineCurrentTarget(new PointerEvent('pointerdown', { pointerId: 1, clientX: 50, bubbles: true }), bar);
      component.onSeekStart(down as PointerEvent);
      expect(component.isSeeking()).toBe(true);
      expect(component.dragTime()).toBe(25);

      const move = defineCurrentTarget(new PointerEvent('pointermove', { pointerId: 1, clientX: 150, bubbles: true }), bar);
      component.onSeekMove(move as PointerEvent);
      expect(component.dragTime()).toBe(75);

      const up = defineCurrentTarget(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }), bar);
      component.onSeekEnd(up as PointerEvent);
      expect(seekSpy).toHaveBeenCalledWith(75);
      expect(component.isSeeking()).toBe(false);
      expect(component.dragTime()).toBeNull();
    });

    it('should seek backward and forward with arrow keys', () => {
      service.state.set({ ...service.state(), currentTime: 30, duration: 120 });
      const seekSpy = vi.spyOn(service, 'seek').mockReturnValue({ isSuccess: () => true } as never);

      component.onSeekKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(seekSpy).toHaveBeenCalledWith(35);

      component.onSeekKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(seekSpy).toHaveBeenCalledWith(25);
    });

    it('should seek to start and end with Home/End keys', () => {
      service.state.set({ ...service.state(), currentTime: 30, duration: 120 });
      const seekSpy = vi.spyOn(service, 'seek').mockReturnValue({ isSuccess: () => true } as never);

      component.onSeekKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
      expect(seekSpy).toHaveBeenCalledWith(0);

      component.onSeekKeydown(new KeyboardEvent('keydown', { key: 'End' }));
      expect(seekSpy).toHaveBeenCalledWith(120);
    });

    it('should not seek with arrow keys when duration is unknown', () => {
      service.state.set({ ...service.state(), duration: 0 });
      const seekSpy = vi.spyOn(service, 'seek');

      component.onSeekKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(seekSpy).not.toHaveBeenCalled();
    });
  });

  describe('mini bar controls', () => {
    function setupTrackWithDuration(): void {
      service.queue.set([{
        id: '1',
        title: 'Track 1',
        artist: 'Artist',
        artistId: 'a1',
        streamUrl: 'url1',
        duration: 120,
      }]);
      service.currentIndex.set(0);
      service.state.update(s => ({
        ...s,
        currentTrackUrl: 'url1',
        currentTime: 30,
        duration: 120,
      }));
    }

    it('should render seek bar, time labels, and prev/next buttons', () => {
      setupTrackWithDuration();

      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement;
      const seekBar = element.querySelector('.audio-player__mini-bar [role="slider"]');
      const prevBtn = element.querySelector('.audio-player__mini-nav-btn[aria-label="Previous track"]');
      const nextBtn = element.querySelector('.audio-player__mini-nav-btn[aria-label="Next track"]');
      const timeLabels = element.querySelectorAll('.audio-player__mini-progress .audio-player__time');

      expect(seekBar).not.toBeNull();
      expect(seekBar?.getAttribute('aria-valuemax')).toBe('120');
      expect(prevBtn).not.toBeNull();
      expect(nextBtn).not.toBeNull();
      expect(timeLabels.length).toBe(3);
      expect(timeLabels[0]?.textContent).toBe('0:30');
      expect(timeLabels[1]?.textContent).toBe('2:00');
      expect(timeLabels[2]?.textContent).toBe('-1:30');
    });

    it('should render the seek marker at the current position', () => {
      setupTrackWithDuration();

      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      const thumb = fixture.nativeElement.querySelector(
        '.audio-player__mini-bar .audio-player__progress-thumb',
      );
      expect(thumb).not.toBeNull();
      expect(thumb.style.left).toBe('25%');
    });

    it('should render the seek bar even when the duration is unknown', () => {
      service.queue.set([{ id: '1', title: 'Track 1', artist: 'Artist', artistId: 'a1', streamUrl: 'url1' }]);
      service.currentIndex.set(0);
      service.state.update(s => ({ ...s, currentTrackUrl: 'url1', currentTime: 0, duration: 0 }));

      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      const seekBar = fixture.nativeElement.querySelector('.audio-player__mini-bar [role="slider"]');
      const thumb = fixture.nativeElement.querySelector('.audio-player__mini-bar .audio-player__progress-thumb');
      expect(seekBar).not.toBeNull();
      expect(thumb).not.toBeNull();
      expect(seekBar?.getAttribute('aria-disabled')).toBe('true');
    });

    it('should not expand the player when interacting with the mini seek bar', () => {
      setupTrackWithDuration();

      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();

      const seekBar = fixture.nativeElement.querySelector('.audio-player__mini-bar [role="slider"]');
      seekBar.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50 }));

      expect(fixture.componentInstance.isExpanded()).toBe(false);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels on the mini bar', () => {
      service.state.update(s => ({ ...s, currentTrackUrl: 'https://example.com/stream.mp3' }));
      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.detectChanges();
      
      const element = fixture.nativeElement;
      const miniBar = element.querySelector('.audio-player__mini-bar');
      const expandBtn = element.querySelector('.audio-player__mini-expand-btn');
      
      expect(miniBar?.getAttribute('aria-label')).toBe('Audio player mini bar');
      expect(expandBtn?.getAttribute('aria-label')).toBe('Expand player');
    });

    it('should have proper ARIA labels in the expanded state', () => {
      service.state.update(s => ({ ...s, currentTrackUrl: 'https://example.com/stream.mp3' }));
      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.componentInstance.isExpanded.set(true);
      fixture.detectChanges();
      
      const element = fixture.nativeElement;
      const collapseBtn = element.querySelector('.audio-player__collapse-btn');
      
      expect(collapseBtn?.getAttribute('aria-label')).toBe('Collapse player');
    });

    it('should have proper tab roles', () => {
      service.state.update(s => ({ ...s, currentTrackUrl: 'https://example.com/stream.mp3' }));
      const fixture = TestBed.createComponent(AudioPlayerComponent);
      fixture.componentInstance.isExpanded.set(true);
      fixture.detectChanges();
      
      const element = fixture.nativeElement;
      const tabs = element.querySelectorAll('[role="tab"]');
      const panels = element.querySelectorAll('[role="tabpanel"]');
      
      expect(tabs.length).toBe(3);
      expect(panels.length).toBe(1);
    });
  });
});
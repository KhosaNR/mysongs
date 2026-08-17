import { TestBed } from '@angular/core/testing';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UploadService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readAudioDuration', () => {
    function installFakeAudio(duration = 0): { fire: (event: string) => void } {
      const handlers = new Map<string, () => void>();

      class FakeAudio {
        preload = '';
        duration = duration;
        src = '';

        addEventListener = (type: string, handler: () => void): void => {
          handlers.set(type, handler);
        };

        removeEventListener = (): void => {
          // No-op — the source is cleared by the service under test.
        };
      }

      vi.spyOn(globalThis, 'Audio').mockImplementation(
        FakeAudio as unknown as typeof Audio,
      );

      return {
        fire: (event: string): void => {
          handlers.get(event)?.();
        },
      };
    }

    it('should return the file duration rounded to whole seconds', async () => {
      const { fire } = installFakeAudio(245.6);
      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
      const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL');

      const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
      const promise = service.readAudioDuration(file);
      fire('loadedmetadata');

      await expect(promise).resolves.toBe(246);
      expect(createUrlSpy).toHaveBeenCalledWith(file);
      expect(revokeUrlSpy).toHaveBeenCalledWith('blob:fake');
    });

    it('should return 0 when the audio metadata cannot be read', async () => {
      const { fire } = installFakeAudio();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
      vi.spyOn(URL, 'revokeObjectURL');

      const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
      const promise = service.readAudioDuration(file);
      fire('error');

      await expect(promise).resolves.toBe(0);
    });

    it('should return 0 when the duration is not finite', async () => {
      const { fire } = installFakeAudio(Number.POSITIVE_INFINITY);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
      vi.spyOn(URL, 'revokeObjectURL');

      const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
      const promise = service.readAudioDuration(file);
      fire('loadedmetadata');

      await expect(promise).resolves.toBe(0);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Result } from '../../core/utils/error-handler';
import { DbService } from '../../core/services/db.service';
import { AuthService } from '../../core/services/auth.service';
import { UploadService } from '../../core/services/upload.service';
import {
  BulkUploadDialogComponent,
  type BulkAlbumOption,
  type BulkTrackDraft,
} from './bulk-upload-dialog.component';

describe('BulkUploadDialogComponent', () => {
  let component: BulkUploadDialogComponent;
  let uploadFile: ReturnType<typeof vi.fn>;
  let createWithId: ReturnType<typeof vi.fn>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const albums: BulkAlbumOption[] = [{ id: 'album_1', title: 'Existing Album' }];

  function audioFile(name: string): File {
    return new File(['audio'], name, { type: 'audio/mpeg' });
  }

  function fileInput(files: File[]): Event {
    return { target: { files } } as unknown as Event;
  }

  /** Stages drafts directly, bypassing file-input parsing. */
  function stageTracks(files: File[]): void {
    component.tracks.set(
      files.map(
        (file, index): BulkTrackDraft => ({
          file,
          title: `Track ${index + 1}`,
          albumArtist: '',
          genre: '',
          trackNumber: index + 1,
          durationSeconds: 200,
          status: 'pending',
        }),
      ),
    );
  }

  beforeEach(async () => {
    uploadFile = vi.fn();
    createWithId = vi.fn().mockResolvedValue(Result.success(undefined));
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BulkUploadDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { albums } },
        {
          provide: DbService,
          useValue: { createWithId, generateId: () => 'generated_id' },
        },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ userId: 'u1', artistId: 'artist_1' }) },
        },
        {
          provide: UploadService,
          useValue: {
            uploadFile,
            uploadProgress: signal(0),
            isRateLimited: signal(false),
            readAudioMetadata: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BulkUploadDialogComponent);
    fixture.componentRef.setInput('albumsInput', albums);
    component = fixture.componentInstance;
  });

  it('should prefer the albums component input when set', () => {
    expect(component.albums()).toEqual(albums);
  });

  it('should fall back to MAT_DIALOG_DATA when no input is set', () => {
    const fixture = TestBed.createComponent(BulkUploadDialogComponent);
    expect(fixture.componentInstance.albums()).toEqual(albums);
  });

  it('should start with nothing staged and submit disabled', () => {
    expect(component.hasTracks()).toBe(false);
    expect(component.canSubmit()).toBe(false);
  });

  it('should enable submit once tracks and an album title exist', () => {
    stageTracks([audioFile('a.mp3')]);
    component.albumTitle.set('New Album');

    expect(component.canSubmit()).toBe(true);
  });

  it('should reject a selection containing no audio files', async () => {
    const nonAudio = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });

    await component.onFilesSelected(fileInput([nonAudio]));

    expect(component.hasTracks()).toBe(false);
    expect(component.error()).toContain('at least one audio');
  });

  it('should stage one draft per audio file, numbered in order', async () => {
    await component.onFilesSelected(
      fileInput([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')]),
    );

    expect(component.tracks().length).toBe(3);
    expect(component.tracks().map((t) => t.trackNumber)).toEqual([1, 2, 3]);
    expect(component.tracks().every((t) => t.status === 'pending')).toBe(true);
  });

  it('should remove a staged track', () => {
    stageTracks([audioFile('a.mp3'), audioFile('b.mp3')]);

    component.removeTrack(0);

    expect(component.tracks().length).toBe(1);
    expect(component.tracks()[0].file.name).toBe('b.mp3');
  });

  it('should format the staged duration using the shared formatter', () => {
    stageTracks([audioFile('a.mp3')]);
    component.tracks.update((tracks) => [{ ...tracks[0], durationSeconds: 3661 }]);

    expect(component.formatDuration(component.tracks()[0].durationSeconds)).toBe('1:01:01');
  });

  describe('upload ordering and isolation', () => {
    it('should create an album when the title does not match an existing one', async () => {
      uploadFile.mockResolvedValue({ objectKey: 'k', publicUrl: 'https://cdn/k' });
      stageTracks([audioFile('a.mp3')]);
      component.albumTitle.set('Brand New Album');

      await component.submit();

      expect(createWithId).toHaveBeenCalledWith(
        'albums',
        'generated_id',
        expect.objectContaining({ title: 'Brand New Album' }),
        { softDeletable: true },
      );
    });

    it('should reuse an existing album with a matching title', async () => {
      uploadFile.mockResolvedValue({ objectKey: 'k', publicUrl: 'https://cdn/k' });
      stageTracks([audioFile('a.mp3')]);
      component.albumTitle.set('existing album');

      await component.submit();

      const albumCalls = createWithId.mock.calls.filter((call) => call[0] === 'albums');
      expect(albumCalls.length).toBe(0);
    });

    it('should create the album, then upload media before each song write', async () => {
      const order: string[] = [];
      uploadFile.mockImplementation(async () => {
        order.push('upload');
        return { objectKey: 'k', publicUrl: 'https://cdn/k' };
      });
      createWithId.mockImplementation(async (collection: string) => {
        order.push(`write:${collection}`);
        return Result.success(undefined);
      });

      stageTracks([audioFile('a.mp3'), audioFile('b.mp3')]);
      component.albumTitle.set('New Album');

      await component.submit();

      // The album must exist before any track can reference it, and each track's
      // media must reach R2 before its own document is written.
      expect(order).toEqual([
        'write:albums',
        'upload',
        'write:songs',
        'upload',
        'write:songs',
      ]);
    });

    it('should not write a song document when the media upload throws', async () => {
      uploadFile.mockRejectedValue(new Error('network down'));

      stageTracks([audioFile('a.mp3')]);
      component.albumTitle.set('New Album');

      await component.submit();

      const songCalls = createWithId.mock.calls.filter((call) => call[0] === 'songs');
      expect(songCalls.length).toBe(0);
      expect(component.failedCount()).toBe(1);
    });

    it('should keep uploading after one track fails', async () => {
      uploadFile
        .mockRejectedValueOnce(new Error('first failed'))
        .mockResolvedValue({ objectKey: 'k', publicUrl: 'https://cdn/k' });

      stageTracks([audioFile('a.mp3'), audioFile('b.mp3')]);
      component.albumTitle.set('New Album');

      await component.submit();

      expect(component.completedCount()).toBe(1);
      expect(component.failedCount()).toBe(1);
    });

    it('should report a failure when every track fails', async () => {
      uploadFile.mockRejectedValue(new Error('nope'));

      stageTracks([audioFile('a.mp3')]);
      component.albumTitle.set('New Album');

      await component.submit();

      expect(component.error()).toContain('No tracks could be uploaded');
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should upload files sequentially, never concurrently', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      uploadFile.mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return { objectKey: 'k', publicUrl: 'https://cdn/k' };
      });

      stageTracks([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')]);
      component.albumTitle.set('New Album');

      await component.submit();

      expect(maxInFlight).toBe(1);
      expect(component.completedCount()).toBe(3);
    });

    it('should clear a failure state when retried', () => {
      stageTracks([audioFile('a.mp3'), audioFile('b.mp3')]);
      component.tracks.update((tracks) => [
        { ...tracks[0], status: 'done' },
        { ...tracks[1], status: 'failed', error: 'boom' },
      ]);

      uploadFile.mockResolvedValue({ objectKey: 'k', publicUrl: 'https://cdn/k' });
      component.albumTitle.set('Existing Album');
      void component.retryFailed();

      expect(component.tracks()[0].status).toBe('done');
      expect(component.tracks()[1].status).not.toBe('failed');
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';
import { DbService } from '../../core/services/db.service';

describe('SearchService', () => {
  let service: SearchService;
  let mockDbService: Partial<DbService>;

  beforeEach(() => {
    mockDbService = {
      getCollection: vi.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: DbService, useValue: mockDbService }],
    });
    service = TestBed.inject(SearchService);
  });

  it('should initialize with empty data', () => {
    expect(service.results()).toEqual([]);
    expect(service.hasResults()).toBe(false);
    expect(service.isSearching()).toBe(false);
  });

  it('should load artists and songs on initializeData', async () => {
    const mockArtists = [
      { data: { artistId: '1', name: 'Test Artist', bio: 'Artist bio', themeColors: { primary: '#fff' } } },
    ];
    const mockSongs = [
      { data: { songId: 's1', title: 'Track 1', artistId: '1', streamUrl: 'url', duration: 180 } },
    ];
    const mockAlbums: { id: string; data: Record<string, unknown> }[] = [];

    vi.mocked(mockDbService.getCollection!).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockArtists,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockAlbums,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockSongs,
    } as any);

    await service.initializeData();

    expect(service.results()).toEqual([]);
    expect(service.isSearching()).toBe(false);
  });

  it('should search artists by name', async () => {
    const mockArtists = [
      { data: { artistId: '1', name: 'Test Artist', bio: 'Bio', themeColors: undefined } },
    ];
    const mockSongs = [
      { data: { songId: 's1', title: 'Track', artistId: '1', streamUrl: 'url', duration: 180 } },
    ];
    const mockAlbums: { id: string; data: Record<string, unknown> }[] = [];

    vi.mocked(mockDbService.getCollection!).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockArtists,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockAlbums,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockSongs,
    } as any);

    await service.initializeData();
    service.search('Test');

    const results = service.results();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('artist');
  });

  it('should search tracks by title', async () => {
    const mockArtists = [
      { data: { artistId: '1', name: 'Test Artist', bio: 'Bio', themeColors: undefined } },
    ];
    const mockSongs = [
      { data: { songId: 's1', title: 'Amazing Song', artistId: '1', streamUrl: 'url', duration: 180 } },
    ];
    const mockAlbums: { id: string; data: Record<string, unknown> }[] = [];

    vi.mocked(mockDbService.getCollection!).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockArtists,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockAlbums,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockSongs,
    } as any);

    await service.initializeData();
    service.search('Amazing');

    const results = service.results();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('track');
  });

  it('should return empty results for empty query', async () => {
    service.search('');
    expect(service.results()).toEqual([]);
  });

  it('should clear search', async () => {
    const mockArtists = [
      { data: { artistId: '1', name: 'Test Artist', bio: 'Bio', themeColors: undefined } },
    ];
    const mockSongs = [
      { data: { songId: 's1', title: 'Track', artistId: '1', streamUrl: 'url', duration: 180 } },
    ];
    const mockAlbums: { id: string; data: Record<string, unknown> }[] = [];

    vi.mocked(mockDbService.getCollection!).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockArtists,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockAlbums,
    } as any).mockResolvedValueOnce({
      isFailure: () => false,
      getData: () => mockSongs,
    } as any);

    await service.initializeData();
    service.search('Test');
    expect(service.results().length).toBeGreaterThan(0);

    service.clearSearch();
    expect(service.results()).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(mockDbService.getCollection!).mockResolvedValue({
      isFailure: () => true,
      getError: () => 'Database error',
    } as any);

    await expect(service.initializeData()).rejects.toThrow('Failed to load artists');
  });
});
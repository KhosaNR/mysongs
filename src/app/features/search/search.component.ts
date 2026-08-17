import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SearchService } from './search.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TrackRowComponent } from '../../shared/components/track-row/track-row.component';
import { ArtistCardComponent } from './components/artist-card/artist-card.component';
import { LyricsSnippetComponent } from './components/lyrics-snippet/lyrics-snippet.component';
import { AddToPlaylistDialogComponent } from '../playlists/add-to-playlist-dialog.component';
import { Song } from '../../shared/models/song.interface';
import { ArtistSearchData, AlbumSearchData } from './models/search-result.interface';

type TabType = 'all' | 'artists' | 'albums' | 'tracks' | 'lyrics';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    TrackRowComponent,
    ArtistCardComponent,
    LyricsSnippetComponent,
    AddToPlaylistDialogComponent,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchPageComponent implements OnInit {
  readonly searchQuery = signal('');
  readonly activeTab = signal<TabType>('all');
  readonly isInitializing = signal(true);

  /** Add-to-playlist dialog state. */
  readonly isPlaylistDialogOpen = signal(false);
  readonly playlistSongIds = signal<string[]>([]);

  readonly results = computed(() => this.searchService.results());
  readonly hasResults = computed(() => this.searchService.hasResults());
  readonly isSearching = computed(() => this.searchService.isSearching());

  readonly filteredResults = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') {
      return this.results();
    }
    return this.results().filter((result) => result.type === tab.slice(0, -1));
  });

  readonly artistResults = computed(() =>
    this.results().filter((result) => result.type === 'artist')
  );
  readonly albumResults = computed(() =>
    this.results().filter((result) => result.type === 'album')
  );
  readonly trackResults = computed(() =>
    this.results().filter((result) => result.type === 'track')
  );
  readonly lyricsResults = computed(() =>
    this.results().filter((result) => result.type === 'lyrics')
  );

  readonly tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'artists', label: 'Artists' },
    { key: 'albums', label: 'Albums' },
    { key: 'tracks', label: 'Tracks' },
    { key: 'lyrics', label: 'Lyrics' },
  ];

  private readonly searchService = inject(SearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    try {
      await this.searchService.initializeData();
    } catch (error) {
      console.error('Failed to initialize search:', error);
    } finally {
      this.isInitializing.set(false);
    }

    // Read the q query parameter if present
    this.route.queryParams.subscribe(params => {
      const query = params['q'];
      if (query) {
        this.searchQuery.set(query);
        this.searchService.search(query);
      }
    });
  }

  setTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  /** Navigates to an artist's detail page. */
  openArtist(artist: ArtistSearchData): void {
    this.router.navigate(['/artist', artist.artistId]);
  }

  /** Navigates to an album's detail page. */
  openAlbum(album: AlbumSearchData): void {
    this.router.navigate(['/album', album.albumId]);
  }

  /** Opens the add-to-playlist dialog for a song. */
  onAddToPlaylist(song: Song): void {
    this.playlistSongIds.set([song.songId]);
    this.isPlaylistDialogOpen.set(true);
  }

  /** Closes the add-to-playlist dialog. */
  closePlaylistDialog(): void {
    this.isPlaylistDialogOpen.set(false);
    this.playlistSongIds.set([]);
  }
}
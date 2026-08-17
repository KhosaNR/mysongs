import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchResult, LyricsSearchData } from '../../models/search-result.interface';

@Component({
  selector: 'app-lyrics-snippet',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lyrics-snippet">
      <div class="lyrics-snippet__header">
        <span class="lyrics-snippet__title">{{ result().item.title }}</span>
        <span class="lyrics-snippet__artist">{{ result().item.artistName }}</span>
      </div>
      <p class="lyrics-snippet__text">{{ result().item.matchedSnippet }}</p>
    </div>
  `,
  styleUrl: './lyrics-snippet.component.scss',
})
export class LyricsSnippetComponent {
  readonly result = input.required<SearchResult<LyricsSearchData>>();
}
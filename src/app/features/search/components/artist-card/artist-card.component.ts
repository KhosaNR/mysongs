import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchResult, ArtistSearchData } from '../../models/search-result.interface';

@Component({
  selector: 'app-artist-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="artist-card" [class.artist-card--clickable]="onClick()">
      <div class="artist-card__content">
        <h3 class="artist-card__name">{{ result().item.name }}</h3>
        @if (result().item.bio) {
          <p class="artist-card__bio">{{ result().item.bio }}</p>
        }
      </div>
    </div>
  `,
  styleUrl: './artist-card.component.scss',
})
export class ArtistCardComponent {
  readonly result = input.required<SearchResult<ArtistSearchData>>();
  readonly onClick = input<(() => void) | null>(null);
}
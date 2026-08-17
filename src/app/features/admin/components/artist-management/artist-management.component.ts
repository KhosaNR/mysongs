import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required } from '@angular/forms/signals';
import { DbService } from '../../../../core/services/db.service';
import { ErrorHandler } from '../../../../core/utils/error-handler';
import { FieldErrorsComponent } from '../../../../shared/components/field-errors/field-errors.component';
import { DEFAULT_PLATFORM_COLORS } from '../../../../core/constants/theme.constants';

interface Artist {
  id: string;
  name: string;
  bio?: string;
  genre?: string;
  artistStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  userId?: string;
  website?: string;
  email?: string;
  phone?: string;
  location?: string;
  themeColors?: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  socialLinks?: {
    spotify?: string;
    appleMusic?: string;
    youtube?: string;
    instagram?: string;
    twitter?: string;
  };
  isActive: boolean;
  createdAt: Date;
}

@Component({
  selector: 'app-artist-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './artist-management.component.html',
  styleUrl: './artist-management.component.scss',
})
export class ArtistManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly artists = signal<Artist[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly editingArtist = signal<Artist | null>(null);

  readonly formData = signal<{
    name: string;
    bio: string;
    genre: string;
    website: string;
    email: string;
    phone: string;
    location: string;
    primaryColor: string;
    secondaryColor: string;
    tertiaryColor: string;
    spotify: string;
    appleMusic: string;
    youtube: string;
    instagram: string;
    twitter: string;
  }>({
    name: '',
    bio: '',
    genre: '',
    website: '',
    email: '',
    phone: '',
    location: '',
    primaryColor: DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
    spotify: '',
    appleMusic: '',
    youtube: '',
    instagram: '',
    twitter: '',
  });

  readonly artistForm = form(this.formData, (p) => {
    required(p.name, { message: 'Artist name is required' });
    required(p.genre, { message: 'Genre is required' });
    required(p.bio, { message: 'Bio is required' });
  });

  constructor() {
    this.loadArtists();
  }

  async loadArtists(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.getCollection<Artist>('artists', {
      constraints: [],
    });

    this.isLoading.set(false);

    if (result.isSuccess()) {
      const artistsData = result.getData();
      this.artists.set(artistsData.map((doc) => doc.data));
    } else {
      this.error.set(result.getError());
    }
  }

  openCreateForm(): void {
    this.editingArtist.set(null);
    this.formData.set({
      name: '',
      bio: '',
      genre: '',
      website: '',
      email: '',
      phone: '',
      location: '',
      primaryColor: DEFAULT_PLATFORM_COLORS.primary,
      secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
      tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
      spotify: '',
      appleMusic: '',
      youtube: '',
      instagram: '',
      twitter: '',
    });
    this.artistForm().reset();
    this.showForm.set(true);
  }

  openEditForm(artist: Artist): void {
    this.editingArtist.set(artist);
    this.formData.set({
      name: artist.name,
      bio: artist.bio || '',
      genre: artist.genre || '',
      website: artist.website || '',
      email: artist.email || '',
      phone: artist.phone || '',
      location: artist.location || '',
      primaryColor: artist.themeColors?.primary || DEFAULT_PLATFORM_COLORS.primary,
      secondaryColor: artist.themeColors?.secondary || DEFAULT_PLATFORM_COLORS.secondary,
      tertiaryColor: artist.themeColors?.tertiary || DEFAULT_PLATFORM_COLORS.tertiary,
      spotify: artist.socialLinks?.spotify || '',
      appleMusic: artist.socialLinks?.appleMusic || '',
      youtube: artist.socialLinks?.youtube || '',
      instagram: artist.socialLinks?.instagram || '',
      twitter: artist.socialLinks?.twitter || '',
    });
    this.artistForm().reset();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingArtist.set(null);
  }

  async saveArtist(): Promise<void> {
    this.artistForm().markAsTouched();
    if (this.artistForm().invalid()) {
      return;
    }

    const data = this.formData();
    const editing = this.editingArtist();

    const artistData: Partial<Artist> = {
      name: data.name,
      bio: data.bio,
      genre: data.genre,
      website: data.website || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      location: data.location || undefined,
      themeColors: {
        primary: data.primaryColor,
        secondary: data.secondaryColor,
        tertiary: data.tertiaryColor,
      },
      socialLinks: {
        spotify: data.spotify || undefined,
        appleMusic: data.appleMusic || undefined,
        youtube: data.youtube || undefined,
        instagram: data.instagram || undefined,
        twitter: data.twitter || undefined,
      },
      isActive: true,
    };

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        if (editing) {
          await this.dbService.update('artists', editing.id, artistData);
        } else {
          const artistId = this.dbService.generateId();
          await this.dbService.createWithId(
            'artists',
            artistId,
            { ...artistData, artistId } as Artist,
            { softDeletable: true },
          );
        }
      },
      editing ? 'updateArtist' : 'createArtist',
      { artistName: data.name },
    );

    this.isLoading.set(false);

    if (result.isSuccess()) {
      this.closeForm();
      await this.loadArtists();
    } else {
      this.error.set(result.getError());
    }
  }

  async deleteArtist(artist: Artist): Promise<void> {
    if (
      !confirm(`Are you sure you want to delete "${artist.name}"? This action cannot be undone.`)
    ) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.errorHandler.execute(
      async () => {
        await this.dbService.delete('artists', artist.id);
      },
      'deleteArtist',
      { artistId: artist.id, artistName: artist.name },
    );

    this.isLoading.set(false);

    if (result.isSuccess()) {
      await this.loadArtists();
    } else {
      this.error.set(result.getError());
    }
  }

  clearError(): void {
    this.error.set(null);
  }
}

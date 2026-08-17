import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required, maxLength } from '@angular/forms/signals';
import { DbService } from '../../../core/services/db.service';
import { AuthService } from '../../../core/services/auth.service';
import { UploadService } from '../../../core/services/upload.service';
import { USER_ROLE } from '../../../core/constants/navigation.constants';
import { Artist, ArtistSocials } from '../../../shared/models/artist.interface';
import { DEFAULT_PLATFORM_COLORS } from '../../../core/constants/theme.constants';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';

/**
 * Artist profile self-management view.
 *
 * Loads the artist's own profile document from `artists/{artistId}`,
 * allows editing profile metadata (bio, country, genre, socials, theme)
 * and uploading a profile photo to R2.
 */
@Component({
  selector: 'app-profile-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './profile-management.component.html',
  styleUrl: './profile-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isUploadingPhoto = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);

  readonly formData = signal({
    name: '',
    bio: '',
    country: '',
    genre: '',
    website: '',
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: '',
    spotify: '',
    appleMusic: '',
    primaryColor: DEFAULT_PLATFORM_COLORS.primary,
    secondaryColor: DEFAULT_PLATFORM_COLORS.secondary,
    tertiaryColor: DEFAULT_PLATFORM_COLORS.tertiary,
  });

  readonly profileForm = form(this.formData, (p) => {
    required(p.name, { message: 'Artist name is required' });
    maxLength(p.bio, 2000, { message: 'Biography must be 2000 characters or fewer' });
  });

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');
  readonly hasArtistId = computed(() => this.artistId().length > 0);
  /** Whether the current user is an approved artist per the auth signal. */
  readonly isApprovedArtist = computed(
    () =>
      this.authService.currentUser()?.role === USER_ROLE.ARTIST &&
      this.authService.currentUser()?.artistStatus === 'approved',
  );
  readonly uploadProgress = this.uploadService.uploadProgress;

  constructor() {
    this.loadProfile();
  }

  /**
   * Loads the artist's own profile from Firestore.
   */
  async loadProfile(): Promise<void> {
    const id = this.artistId();
    if (!id) {
      this.error.set('No artist ID assigned to this account.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.dbService.getDocument<Artist>('artists', id);
      if (result.isSuccess()) {
        const artist = result.getData().data;
        this.formData.set({
          name: artist.name || '',
          bio: artist.bio || '',
          country: artist.country || '',
          genre: artist.genre || '',
          website: artist.socials?.website || '',
          facebook: artist.socials?.facebook || '',
          instagram: artist.socials?.instagram || '',
          twitter: artist.socials?.twitter || '',
          youtube: artist.socials?.youtube || '',
          spotify: artist.socials?.spotify || '',
          appleMusic: artist.socials?.appleMusic || '',
          primaryColor: artist.themeColors?.primary || DEFAULT_PLATFORM_COLORS.primary,
          secondaryColor: artist.themeColors?.secondary || DEFAULT_PLATFORM_COLORS.secondary,
          tertiaryColor: artist.themeColors?.tertiary || DEFAULT_PLATFORM_COLORS.tertiary,
        });
        this.profileForm().reset();
        if (artist.photoURL) {
          this.photoPreview.set(artist.photoURL);
        }
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handles selection of a new profile photo, showing a local preview.
   */
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photoPreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      this.photoSelectedFile.set(file);
    }
  }

  private photoSelectedFile = signal<File | null>(null);

  /**
   * Uploads the photo (if selected) then saves the profile data.
   */
  async saveProfile(): Promise<void> {
    this.profileForm().markAsTouched();
    if (this.profileForm().invalid()) {
      return;
    }

    const id = this.artistId();
    if (!id) {
      this.error.set('No artist ID assigned to this account.');
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      let photoURL: string | undefined;

      const photoFile = this.photoSelectedFile();
      if (photoFile) {
        this.isUploadingPhoto.set(true);
        const upload = await this.uploadService.uploadFile(photoFile);
        photoURL = upload.publicUrl;
        this.isUploadingPhoto.set(false);
      }

      const data = this.formData();
      const socials: ArtistSocials = {
        website: data.website.trim() || undefined,
        facebook: data.facebook.trim() || undefined,
        instagram: data.instagram.trim() || undefined,
        twitter: data.twitter.trim() || undefined,
        youtube: data.youtube.trim() || undefined,
        spotify: data.spotify.trim() || undefined,
        appleMusic: data.appleMusic.trim() || undefined,
      };

      const updateData: Partial<Artist> = {
        name: data.name.trim(),
        bio: data.bio.trim(),
        country: data.country.trim(),
        genre: data.genre.trim(),
        socials,
        themeColors: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          tertiary: data.tertiaryColor,
        },
        ...(photoURL ? { photoURL } : {}),
        updatedAt: new Date(),
      };

      const result = await this.dbService.update('artists', id, updateData);
      if (result.isSuccess()) {
        this.successMessage.set('Profile saved successfully.');
        this.photoSelectedFile.set(null);
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.isUploadingPhoto.set(false);
      this.error.set(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      this.isSaving.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }

  clearSuccess(): void {
    this.successMessage.set(null);
  }
}

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required } from '@angular/forms/signals';
import { where } from '@angular/fire/firestore';
import { DbService } from '../../../core/services/db.service';
import { AuthService } from '../../../core/services/auth.service';
import { FieldErrorsComponent } from '../../../shared/components/field-errors/field-errors.component';

interface Sponsor {
  id: string;
  name: string;
  artistId: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  createdAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

/** Artist sponsor management view scoped to the artist's own sponsors. */
@Component({
  selector: 'app-sponsor-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './sponsor-management.component.html',
  styleUrl: './sponsor-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SponsorManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly authService = inject(AuthService);

  readonly sponsors = signal<Sponsor[]>([]);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly isEditMode = signal(false);
  readonly editingSponsorId = signal<string | null>(null);

  readonly formData = signal({
    name: '',
    logoUrl: '',
    websiteUrl: '',
    description: '',
    tier: 'bronze' as Sponsor['tier'],
  });

  readonly sponsorForm = form(this.formData, (p) => {
    required(p.name, { message: 'Sponsor name is required' });
  });

  readonly artistId = computed(() => this.authService.currentUser()?.artistId || '');

  constructor() {
    this.loadSponsors();
  }

  async loadSponsors(): Promise<void> {
    const id = this.artistId();
    if (!id) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.getCollection<Sponsor>('sponsors', {
        constraints: [where('artistId', '==', id)],
      });
      if (result.isSuccess()) {
        this.sponsors.set(result.getData().map((doc) => ({ ...doc.data, id: doc.id })));
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load sponsors');
    } finally {
      this.isLoading.set(false);
    }
  }

  openCreateForm(): void {
    this.formData.set({ name: '', logoUrl: '', websiteUrl: '', description: '', tier: 'bronze' });
    this.sponsorForm().reset();
    this.isEditMode.set(false);
    this.editingSponsorId.set(null);
    this.showForm.set(true);
  }

  openEditForm(sponsor: Sponsor): void {
    this.formData.set({
      name: sponsor.name,
      logoUrl: sponsor.logoUrl || '',
      websiteUrl: sponsor.websiteUrl || '',
      description: sponsor.description || '',
      tier: sponsor.tier,
    });
    this.sponsorForm().reset();
    this.isEditMode.set(true);
    this.editingSponsorId.set(sponsor.id);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.isEditMode.set(false);
    this.editingSponsorId.set(null);
  }

  async submitForm(): Promise<void> {
    this.sponsorForm().markAsTouched();
    if (this.sponsorForm().invalid()) {
      return;
    }

    const id = this.artistId();
    const data = this.formData();
    if (!id) {
      this.error.set('No artist ID assigned to this account.');
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    const sponsorData: Partial<Sponsor> = {
      name: data.name.trim(),
      artistId: id,
      logoUrl: data.logoUrl.trim() || undefined,
      websiteUrl: data.websiteUrl.trim() || undefined,
      description: data.description.trim() || undefined,
      tier: data.tier,
      isActive: true,
    };

    try {
      const result =
        this.isEditMode() && this.editingSponsorId()
          ? await this.dbService.update('sponsors', this.editingSponsorId()!, sponsorData)
          : await this.dbService.create('sponsors', {
              ...sponsorData,
              createdAt: new Date(),
            } as Sponsor);
      if (result.isSuccess()) {
        this.closeForm();
        await this.loadSponsors();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to save sponsor');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async softDeleteSponsor(sponsor: Sponsor): Promise<void> {
    if (!confirm(`Delete sponsor "${sponsor.name}"?`)) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.softDelete('sponsors', sponsor.id);
      if (result.isSuccess()) {
        await this.loadSponsors();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to delete sponsor');
    } finally {
      this.isLoading.set(false);
    }
  }

  async restoreSponsor(sponsor: Sponsor): Promise<void> {
    if (!confirm(`Restore sponsor "${sponsor.name}"?`)) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.dbService.restore('sponsors', sponsor.id);
      if (result.isSuccess()) {
        await this.loadSponsors();
      } else {
        this.error.set(result.getError());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to restore sponsor');
    } finally {
      this.isLoading.set(false);
    }
  }

  getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2',
    };
    return colors[tier] || '#888';
  }

  clearError(): void {
    this.error.set(null);
  }
}

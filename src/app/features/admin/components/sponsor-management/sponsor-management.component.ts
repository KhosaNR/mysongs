import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormRoot, FormField, form, required } from '@angular/forms/signals';
import { DbService } from '../../../../core/services/db.service';
import { ErrorHandler } from '../../../../core/utils/error-handler';
import { FieldErrorsComponent } from '../../../../shared/components/field-errors/field-errors.component';

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
}

@Component({
  selector: 'app-sponsor-management',
  standalone: true,
  imports: [CommonModule, FormRoot, FormField, FieldErrorsComponent],
  templateUrl: './sponsor-management.component.html',
  styleUrl: './sponsor-management.component.scss',
})
export class SponsorManagementComponent {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly sponsors = signal<Sponsor[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly isSubmitting = signal(false);

  readonly formData = signal({
    name: '',
    artistId: '',
    logoUrl: '',
    websiteUrl: '',
    description: '',
    tier: 'bronze' as Sponsor['tier'],
  });

  readonly sponsorForm = form(this.formData, (p) => {
    required(p.name, { message: 'Sponsor name is required' });
    required(p.artistId, { message: 'Artist ID is required' });
  });

  constructor() {
    this.loadSponsors();
  }

  async loadSponsors(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.getCollection<Sponsor>('sponsors', {
      constraints: [],
    });

    this.isLoading.set(false);

    if (result.isSuccess()) {
      const sponsorsData = result.getData();
      this.sponsors.set(sponsorsData.map((doc) => doc.data));
    } else {
      this.error.set(result.getError());
    }
  }

  openForm(): void {
    this.sponsorForm().reset();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.formData.set({
      name: '',
      artistId: '',
      logoUrl: '',
      websiteUrl: '',
      description: '',
      tier: 'bronze',
    });
    this.sponsorForm().reset();
  }

  async submitForm(): Promise<void> {
    this.sponsorForm().markAsTouched();
    if (this.sponsorForm().invalid()) {
      return;
    }

    const data = this.formData();

    this.isSubmitting.set(true);
    this.error.set(null);

    const sponsorData: Partial<Sponsor> = {
      name: data.name,
      artistId: data.artistId,
      logoUrl: data.logoUrl || undefined,
      websiteUrl: data.websiteUrl || undefined,
      description: data.description || undefined,
      tier: data.tier,
      isActive: true,
    };

    const result = await this.dbService.create('sponsors', sponsorData as Sponsor);

    this.isSubmitting.set(false);

    if (result.isSuccess()) {
      this.closeForm();
      await this.loadSponsors();
    } else {
      this.error.set(result.getError());
    }
  }

  async deleteSponsor(sponsor: Sponsor): Promise<void> {
    if (!confirm(`Are you sure you want to delete "${sponsor.name}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.dbService.delete('sponsors', sponsor.id);

    this.isLoading.set(false);

    if (result.isSuccess()) {
      await this.loadSponsors();
    } else {
      this.error.set(result.getError());
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

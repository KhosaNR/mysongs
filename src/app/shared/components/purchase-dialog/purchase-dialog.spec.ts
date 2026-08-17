/**
 * Unit tests for PurchaseDialogComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PurchaseDialogComponent } from './purchase-dialog.component';
import { Song } from '../../models/song.interface';

const mockSong: Song = {
  songId: 'track_001',
  artistId: 'artist_01',
  title: 'Your Love feat Hopey B',
  streamUrl: 'https://pub-r2.dev/stream/track_001.mp3',
  securePath: 'secure_audio/track_001_320.mp3',
  priceZAR: 5.0,
  writtenBy: 'Bongani Mbhiza',
};

describe('PurchaseDialogComponent', () => {
  let component: PurchaseDialogComponent;
  let fixture: ComponentFixture<PurchaseDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseDialogComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('pay-what-you-want amount', () => {
    it('should default the amount to the song standard price', async () => {
      fixture.componentRef.setInput('song', mockSong);
      await fixture.whenStable();
      expect(component['priceFormData']().amount).toBe(5.0);
    });

    it('should default the amount to the album standard price', async () => {
      fixture.componentRef.setInput('album', {
        id: 'album_1',
        title: 'Ku Langhe Mbilu',
        priceZAR: 30.0,
        minimumPriceZAR: 15.0,
        artistName: 'Leo Bee',
        trackCount: 16,
      });
      await fixture.whenStable();
      expect(component['priceFormData']().amount).toBe(30.0);
    });

    it('should use the configured minimum as the payable floor', async () => {
      fixture.componentRef.setInput('song', { ...mockSong, minimumPriceZAR: 3.0 });
      await fixture.whenStable();
      expect(component['effectiveMinimum']()).toBe(3.0);
    });

    it('should fall back to the standard price as the floor when no minimum is set', async () => {
      fixture.componentRef.setInput('song', mockSong);
      await fixture.whenStable();
      expect(component['effectiveMinimum']()).toBe(5.0);
    });

    it('should emit the chosen amount on purchase', async () => {
      fixture.componentRef.setInput('state', 'confirm');
      fixture.componentRef.setInput('song', mockSong);
      await fixture.whenStable();
      const spy = vi.spyOn(component.purchase, 'emit');
      component['priceFormData'].set({ amount: 7.5 });
      component['onPurchase']();
      expect(spy).toHaveBeenCalledWith(7.5);
    });

    it('should block a purchase below the minimum price', async () => {
      fixture.componentRef.setInput('state', 'confirm');
      fixture.componentRef.setInput('song', { ...mockSong, minimumPriceZAR: 3.0 });
      await fixture.whenStable();
      const spy = vi.spyOn(component.purchase, 'emit');
      component['priceFormData'].set({ amount: 2.0 });
      component['onPurchase']();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should keep a user-edited amount when the item does not change', async () => {
      fixture.componentRef.setInput('state', 'confirm');
      fixture.componentRef.setInput('song', mockSong);
      await fixture.whenStable();
      component['priceFormData'].set({ amount: 8.0 });
      await fixture.whenStable();
      expect(component['priceFormData']().amount).toBe(8.0);
    });

    it('should reset the amount to standard when a different item is shown', async () => {
      fixture.componentRef.setInput('song', mockSong);
      await fixture.whenStable();
      component['priceFormData'].set({ amount: 8.0 });
      fixture.componentRef.setInput('song', { ...mockSong, songId: 'track_002', title: 'Other' });
      await fixture.whenStable();
      expect(component['priceFormData']().amount).toBe(5.0);
    });
  });

  describe('album rendering', () => {
    it('should render the album title and track count in the confirm state', async () => {
      fixture.componentRef.setInput('state', 'confirm');
      fixture.componentRef.setInput('album', {
        id: 'album_1',
        title: 'Ku Langhe Mbilu',
        priceZAR: 30.0,
        minimumPriceZAR: 15.0,
        artistName: 'Leo Bee',
        trackCount: 16,
      });
      await fixture.whenStable();
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Ku Langhe Mbilu');
      expect(text).toContain('16 tracks');
      expect(text).toContain('30.00');
    });

    it('should render the guest sign-in prompt for guests', async () => {
      fixture.componentRef.setInput('state', 'guest');
      fixture.componentRef.setInput('song', mockSong);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Sign in to download');
    });
  });
});

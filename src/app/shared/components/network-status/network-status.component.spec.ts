/**
 * Unit tests for NetworkStatusComponent.
 *
 * Regression tests for the offline banner appearing while the website is
 * still loading: the banner must not render from the boot-time
 * `navigator.onLine` snapshot. It appears only once offline is confirmed —
 * a browser `offline` event or a reported network failure — and clears on
 * recovery or dismissal.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetworkStatusComponent } from './network-status.component';
import { NetworkStatusService } from '../../../core/services/network-status.service';

describe('NetworkStatusComponent', () => {
  let fixture: ComponentFixture<NetworkStatusComponent>;
  let networkStatus: NetworkStatusService;

  beforeEach(async () => {
    // Simulate a browser reporting offline before the app bootstraps — the
    // exact condition that used to flash the offline banner on page load.
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await TestBed.configureTestingModule({
      imports: [NetworkStatusComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NetworkStatusComponent);
    networkStatus = TestBed.inject(NetworkStatusService);
    fixture.detectChanges();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  function banner(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.network-status') as HTMLElement | null;
  }

  // ==========================================================================
  // BOOT STATE (the reported bug)
  // ==========================================================================

  it('should not show the offline banner at boot while the site is loading', () => {
    expect(navigator.onLine).toBe(false);
    expect(banner()).toBeNull();
  });

  // ==========================================================================
  // CONFIRMED OFFLINE
  // ==========================================================================

  it('should show the banner after a confirmed network failure', () => {
    networkStatus.reportNetworkFailure();
    fixture.detectChanges();

    expect(banner()).not.toBeNull();
  });

  it('should show the banner on a browser offline event', () => {
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    expect(banner()).not.toBeNull();
  });

  // ==========================================================================
  // RECOVERY
  // ==========================================================================

  it('should hide the banner when connectivity is restored', () => {
    networkStatus.reportNetworkFailure();
    fixture.detectChanges();
    expect(banner()).not.toBeNull();

    networkStatus.reportNetworkSuccess();
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it('should hide the banner when dismissed', () => {
    networkStatus.reportNetworkFailure();
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector('.network-status__dismiss') as HTMLButtonElement;
    expect(dismiss).toBeTruthy();

    dismiss.click();
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });
});

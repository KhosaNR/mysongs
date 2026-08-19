/**
 * Unit tests for NetworkStatusService.
 *
 * Verifies the "confirmed offline" model: the service starts optimistically
 * online (ignoring the unreliable boot-time `navigator.onLine` snapshot, which
 * browsers can report as `false` during early page load even though the site
 * loads fine) and only reports offline after a browser `offline` event or an
 * explicit `reportNetworkFailure()` from the central error pipeline.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NetworkStatusService } from './network-status.service';

describe('NetworkStatusService', () => {
  let service: NetworkStatusService;

  beforeEach(() => {
    // Simulate a browser reporting offline before the app bootstraps — the
    // exact condition that used to flash the offline banner on page load.
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    TestBed.configureTestingModule({});
    service = TestBed.inject(NetworkStatusService);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ==========================================================================
  // INITIAL STATE
  // ==========================================================================

  it('should start online even when navigator.onLine reports false at boot', () => {
    expect(navigator.onLine).toBe(false);
    expect(service.isOnline()).toBe(true);
  });

  it('should start without the one-shot reconnection flag', () => {
    expect(service.wasOffline()).toBe(false);
  });

  // ==========================================================================
  // CONFIRMED FAILURE / SUCCESS REPORTING
  // ==========================================================================

  it('should report offline after a confirmed network failure', () => {
    service.reportNetworkFailure();

    expect(service.isOnline()).toBe(false);
  });

  it('should restore online after a reported network success', () => {
    service.reportNetworkFailure();
    service.reportNetworkSuccess();

    expect(service.isOnline()).toBe(true);
    expect(service.wasOffline()).toBe(true);
  });

  it('should not set wasOffline when reporting success while already online', () => {
    service.reportNetworkSuccess();

    expect(service.isOnline()).toBe(true);
    expect(service.wasOffline()).toBe(false);
  });

  it('should auto-reset wasOffline after the reconnection flow is consumed', async () => {
    service.reportNetworkFailure();
    service.reportNetworkSuccess();
    expect(service.wasOffline()).toBe(true);

    // Flush the one-shot reset effect (no fixture in a service-only test),
    // then let the one-tick timeout it schedules complete.
    TestBed.flushEffects();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(service.wasOffline()).toBe(false);
  });

  // ==========================================================================
  // BROWSER EVENTS
  // ==========================================================================

  it('should go offline on the window offline event', () => {
    window.dispatchEvent(new Event('offline'));

    expect(service.isOnline()).toBe(false);
  });

  it('should come back online on the window online event and flag wasOffline', () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));

    expect(service.isOnline()).toBe(true);
    expect(service.wasOffline()).toBe(true);
  });
});

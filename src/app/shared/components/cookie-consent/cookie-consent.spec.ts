import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CookieConsentComponent } from './cookie-consent.component';

const STORAGE_KEY = 'cookie-consent';

describe('CookieConsentComponent', () => {
  let fixture: ComponentFixture<CookieConsentComponent>;
  let component: CookieConsentComponent;
  let localStorageMock: Record<string, string>;

  beforeEach(async () => {
    localStorageMock = {};

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
    });

    await TestBed.configureTestingModule({
      imports: [CookieConsentComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CookieConsentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the banner when no consent has been given', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('We use cookies to enhance your experience');
  });

  it('should render accept button', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toContain('Accept');
  });

  it('should render links to cookie and privacy policies', () => {
    const el = fixture.nativeElement as HTMLElement;
    const links = el.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('routerLink')).toBe('/legal/cookies');
    expect(links[1].getAttribute('routerLink')).toBe('/legal/privacy');
  });

  it('should apply the dialog role', () => {
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
  });

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  it('should not show the banner if consent was previously given', () => {
    localStorageMock[STORAGE_KEY] = 'accepted';

    const newFixture = TestBed.createComponent(CookieConsentComponent);
    newFixture.detectChanges();
    const el = newFixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('We use cookies');
  });

  it('should store consent and dismiss on accept', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button')!;
    btn.click();

    expect(localStorageMock[STORAGE_KEY]).toBe('accepted');
    expect(component['isDismissed']()).toBe(true);
  });

  it('should hide the banner after accept', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button')!;
    btn.click();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('We use cookies');
  });

  // ==========================================================================
  // SS SAFETY
  // ==========================================================================

  it('should handle unavailable localStorage gracefully', () => {
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true,
    });

    const safeFixture = TestBed.createComponent(CookieConsentComponent);
    safeFixture.detectChanges();
    expect(safeFixture.componentInstance).toBeTruthy();
  });
});
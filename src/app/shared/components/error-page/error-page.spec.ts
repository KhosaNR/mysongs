import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ErrorPageComponent } from './error-page.component';

describe('ErrorPageComponent', () => {
  let fixture: ComponentFixture<ErrorPageComponent>;
  let component: ErrorPageComponent;
  let routerNavigateMock: ReturnType<typeof vi.fn>;
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    routerNavigateMock = vi.fn();
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    await TestBed.configureTestingModule({
      imports: [ErrorPageComponent],
      providers: [
        { provide: Router, useValue: { navigate: routerNavigateMock } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the default status code 500', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('500');
  });

  it('should render the default title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Something went wrong');
  });

  it('should render the default message', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('An unexpected error occurred');
  });

  it('should render a custom status code', () => {
    fixture.componentRef.setInput('statusCode', 404);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('404');
  });

  it('should render a custom title and message', () => {
    fixture.componentRef.setInput('title', 'Access Denied');
    fixture.componentRef.setInput('message', 'You do not have permission.');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Access Denied');
    expect(el.textContent).toContain('You do not have permission.');
  });

  it('should apply the alert role', () => {
    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('[role="alert"]');
    expect(container).toBeTruthy();
  });

  // ==========================================================================
  // AUTO-REDIRECT COUNTDOWN
  // ==========================================================================

  it('should show countdown when redirectRoute is provided', () => {
    fixture.componentRef.setInput('redirectRoute', '/home');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Redirecting to /home in');
    expect(el.textContent).toContain('30s');
  });

  it('should not show countdown when redirectRoute is empty', () => {
    fixture.componentRef.setInput('redirectRoute', '');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Redirecting');
  });

  it('should decrement the countdown each second', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('redirectRoute', '/home');
    fixture.detectChanges();

    const countdown = (component as any).countdown();
    expect(countdown).toBe(30);
    vi.advanceTimersByTime(1000);
    expect((component as any).countdown()).toBe(29);
    vi.advanceTimersByTime(2000);
    expect((component as any).countdown()).toBe(27);
  });

  it('should navigate when countdown reaches zero', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('redirectRoute', '/home');
    fixture.detectChanges();

    vi.advanceTimersByTime(30000);
    expect(routerNavigateMock).toHaveBeenCalledWith(['/home']);
  });

  it('should clear the interval on destroy', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('redirectRoute', '/home');
    fixture.detectChanges();

    fixture.destroy();
    vi.advanceTimersByTime(5000);
    expect(routerNavigateMock).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // ACTION BUTTONS
  // ==========================================================================

  it('should navigate to home on "Go Home" button click', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    const goHomeBtn = Array.from(buttons).find((b) => b.textContent?.includes('Go Home'));
    expect(goHomeBtn).toBeTruthy();
    goHomeBtn!.click();
    expect(routerNavigateMock).toHaveBeenCalledWith(['/']);
  });

  it('should reload the page on "Try Again" button click', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    const tryAgainBtn = Array.from(buttons).find((b) => b.textContent?.includes('Try Again'));
    expect(tryAgainBtn).toBeTruthy();
    tryAgainBtn!.click();
    expect(reloadMock).toHaveBeenCalled();
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let fixture: ComponentFixture<NotFoundComponent>;
  let routerNavigateMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    routerNavigateMock = vi.fn();

    await TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [
        { provide: Router, useValue: { navigate: routerNavigateMock } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
  });

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  it('should create the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render 404 status code', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('404');
  });

  it('should render the title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Page not found');
  });

  it('should render the descriptive message', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("This track doesn't seem to exist");
  });

  it('should render the headphones illustration SVG', () => {
    const el = fixture.nativeElement as HTMLElement;
    const svg = el.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  // ==========================================================================
  // ACTION BUTTON
  // ==========================================================================

  it('should render "Back to Home" button', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toContain('Back to Home');
  });

  it('should navigate to home on button click', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button')!;
    btn.click();
    expect(routerNavigateMock).toHaveBeenCalledWith(['/']);
  });
});
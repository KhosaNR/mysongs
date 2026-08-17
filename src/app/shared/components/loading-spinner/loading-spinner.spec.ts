/**
 * Unit tests for LoadingSpinnerComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingSpinnerComponent } from './loading-spinner.component';

describe('LoadingSpinnerComponent', () => {
  let component: LoadingSpinnerComponent;
  let fixture: ComponentFixture<LoadingSpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingSpinnerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingSpinnerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to spinner variant', () => {
    expect(component.variant()).toBe('spinner');
  });

  it('should default to md size', () => {
    expect(component.size()).toBe('md');
  });

  it('should have empty label by default', () => {
    expect(component.label()).toBe('');
  });

  it('should render spinner SVG when variant is spinner', () => {
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('.loading__spinner');
    expect(svg).toBeTruthy();
  });

  it('should render skeleton blocks when variant is skeleton', () => {
    fixture.componentRef.setInput('variant', 'skeleton');
    fixture.detectChanges();
    const skeleton = fixture.nativeElement.querySelector('.loading__skeleton');
    expect(skeleton).toBeTruthy();
  });

  it('should display label text when provided', () => {
    fixture.componentRef.setInput('label', 'Loading tracks...');
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.loading__label');
    expect(label).toBeTruthy();
    expect(label.textContent).toContain('Loading tracks...');
  });

  it('should apply size classes correctly', () => {
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('.loading');
    expect(host.classList).toContain('loading--sm');

    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    expect(host.classList).toContain('loading--lg');
  });

  it('should set aria-label for accessibility', () => {
    fixture.componentRef.setInput('label', 'Loading');
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('[role="status"]');
    expect(host.getAttribute('aria-label')).toBe('Loading');
  });

  it('should use default aria-label when no label provided', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('[role="status"]');
    expect(host.getAttribute('aria-label')).toBe('Loading');
  });
});
/**
 * Unit tests for EmptyStateComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent, EmptyStateIcon } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inputs', () => {
    it('should display the title text', () => {
      fixture.componentRef.setInput('title', 'Nothing here');
      fixture.detectChanges();

      const titleEl = fixture.nativeElement.querySelector('.empty-state__title');
      expect(titleEl).toBeTruthy();
      expect(titleEl.textContent).toContain('Nothing here');
    });

    it('should use default title', () => {
      expect(component.title()).toBe('Nothing here yet');
    });

    it('should use default icon', () => {
      expect(component.icon()).toBe('empty-box');
    });

    it('should display description when provided', () => {
      fixture.componentRef.setInput('description', 'Add some content');
      fixture.detectChanges();

      const descEl = fixture.nativeElement.querySelector('.empty-state__description');
      expect(descEl).toBeTruthy();
      expect(descEl.textContent).toContain('Add some content');
    });

    it('should hide description when not provided', () => {
      fixture.detectChanges();

      const descEl = fixture.nativeElement.querySelector('.empty-state__description');
      expect(descEl).toBeFalsy();
    });

    it('should show action button when actionLabel is provided', () => {
      fixture.componentRef.setInput('actionLabel', 'Browse tracks');
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('.empty-state__action-btn');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('Browse tracks');
    });

    it('should hide action button when actionLabel is empty', () => {
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('.empty-state__action-btn');
      expect(btn).toBeFalsy();
    });

    it('should render correct SVG for each icon variant', () => {
      const variants: EmptyStateIcon[] = ['empty-box', 'search', 'music', 'cart'];
      for (const variant of variants) {
        fixture.componentRef.setInput('icon', variant);
        fixture.detectChanges();

        const svg = fixture.nativeElement.querySelector('.empty-state__icon svg');
        expect(svg).toBeTruthy();
      }
    });

    it('should always render the standard empty-state root without size variants', () => {
      fixture.detectChanges();

      const host = fixture.nativeElement.querySelector('.empty-state');
      expect(host).toBeTruthy();
      expect(host.classList.contains('empty-state--compact')).toBe(false);
    });
  });

  describe('Outputs', () => {
    it('should emit action when action button is clicked', () => {
      fixture.componentRef.setInput('actionLabel', 'Browse');
      fixture.detectChanges();

      let emitted = false;
      component.action.subscribe(() => {
        emitted = true;
      });

      const btn = fixture.nativeElement.querySelector('.empty-state__action-btn');
      btn.click();
      fixture.detectChanges();

      expect(emitted).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have role status', () => {
      fixture.detectChanges();

      const host = fixture.nativeElement.querySelector('.empty-state');
      expect(host.getAttribute('role')).toBe('status');
    });

    it('should have aria-hidden on icon', () => {
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.empty-state__icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
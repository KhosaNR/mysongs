/**
 * Unit tests for ToastComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastComponent', () => {
  let component: ToastComponent;
  let fixture: ComponentFixture<ToastComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render toasts from the service', () => {
    toastService.show('First toast');
    toastService.show('Second toast');
    fixture.detectChanges();

    const toastElements = fixture.nativeElement.querySelectorAll('.toast');
    expect(toastElements.length).toBe(2);
    expect(toastElements[0].textContent).toContain('Second toast');
    expect(toastElements[1].textContent).toContain('First toast');
  });

  it('should show dismiss buttons on dismissible toasts', () => {
    toastService.show('Test', { dismissible: true });
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector('.toast__dismiss');
    expect(dismissBtn).toBeTruthy();
  });

  it('should hide dismiss buttons on non-dismissible toasts', () => {
    toastService.show('Test', { dismissible: false });
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector('.toast__dismiss');
    expect(dismissBtn).toBeFalsy();
  });

  it('should dismiss a toast when dismiss button is clicked', () => {
    toastService.show('Test');
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(1);

    const dismissBtn = fixture.nativeElement.querySelector('.toast__dismiss');
    dismissBtn.click();
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(0);
  });

  it('should show dismiss all button when 2+ toasts are present', () => {
    toastService.show('First');
    toastService.show('Second');
    fixture.detectChanges();

    const dismissAllBtn = fixture.nativeElement.querySelector('.toast__dismiss-all');
    expect(dismissAllBtn).toBeTruthy();
  });

  it('should hide dismiss all button when 0-1 toasts are present', () => {
    toastService.show('Only one');
    fixture.detectChanges();

    const dismissAllBtn = fixture.nativeElement.querySelector('.toast__dismiss-all');
    expect(dismissAllBtn).toBeFalsy();
  });

  it('should dismiss all toasts when dismiss all is clicked', () => {
    toastService.show('First');
    toastService.show('Second');
    toastService.show('Third');
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(3);

    const dismissAllBtn = fixture.nativeElement.querySelector('.toast__dismiss-all');
    dismissAllBtn.click();
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(0);
  });

  it('should apply correct variant class based on toast type', () => {
    toastService.show('Error', { type: 'error' });
    toastService.show('Success', { type: 'success' });
    toastService.show('Warning', { type: 'warning' });
    toastService.show('Info', { type: 'info' });
    fixture.detectChanges();

    const toasts = fixture.nativeElement.querySelectorAll('.toast');
    expect(toasts[0].classList.contains('toast--info')).toBe(true);
    expect(toasts[1].classList.contains('toast--warning')).toBe(true);
    expect(toasts[2].classList.contains('toast--success')).toBe(true);
    expect(toasts[3].classList.contains('toast--error')).toBe(true);
  });

  describe('Accessibility', () => {
    it('should set aria-live on container', () => {
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.toast-container');
      expect(container.getAttribute('aria-live')).toBe('polite');
    });

    it('should set aria-relevant on container', () => {
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.toast-container');
      expect(container.getAttribute('aria-relevant')).toBe('all');
    });

    it('should have role status on each toast', () => {
      toastService.show('Test');
      fixture.detectChanges();

      const toast = fixture.nativeElement.querySelector('.toast');
      expect(toast.getAttribute('role')).toBe('status');
    });

    it('should have aria-label on dismiss button', () => {
      toastService.show('Test');
      fixture.detectChanges();

      const dismissBtn = fixture.nativeElement.querySelector('.toast__dismiss');
      expect(dismissBtn.getAttribute('aria-label')).toBe('Dismiss notification');
    });
  });
});
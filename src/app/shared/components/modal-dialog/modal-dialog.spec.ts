/**
 * Unit tests for ModalDialogComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalDialogComponent } from './modal-dialog.component';

describe('ModalDialogComponent', () => {
  let component: ModalDialogComponent;
  let fixture: ComponentFixture<ModalDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default isOpen to false', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should have empty title by default', () => {
    expect(component.title()).toBe('');
  });

  it('should default to md size', () => {
    expect(component.size()).toBe('md');
  });

  it('should default closeOnBackdrop to true', () => {
    expect(component.closeOnBackdrop()).toBe(true);
  });

  it('should not render modal content when isOpen is false', () => {
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.modal-overlay');
    expect(overlay).toBeFalsy();
  });

  it('should render modal when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
  });

  it('should display title in the header', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Confirm Purchase');
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.modal__title');
    expect(title.textContent).toContain('Confirm Purchase');
  });

  it('should emit close when close button is clicked', () => {
    vi.spyOn(component.dismiss, 'emit');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const closeBtn = fixture.nativeElement.querySelector('.modal__close-btn');
    closeBtn.click();
    expect(component.dismiss.emit).toHaveBeenCalled();
  });

  it('should emit close when backdrop is clicked', () => {
    vi.spyOn(component.dismiss, 'emit');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.modal-overlay');
    overlay.click();
    expect(component.dismiss.emit).toHaveBeenCalled();
  });

  it('should not emit close when modal content is clicked', () => {
    vi.spyOn(component.dismiss, 'emit');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.modal');
    modal.click();
    expect(component.dismiss.emit).not.toHaveBeenCalled();
  });

  it('should have accessible role and aria attributes', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Test Dialog');
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(overlay).toBeTruthy();
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.getAttribute('aria-label')).toBe('Test Dialog');
  });

  it('should apply size classes correctly', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.modal');
    expect(modal.classList).toContain('modal--lg');

    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect(modal.classList).toContain('modal--sm');
  });
});
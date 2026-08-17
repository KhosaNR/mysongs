/**
 * Unit tests for FieldErrorsComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injector, signal } from '@angular/core';
import { form, required } from '@angular/forms/signals';
import { FieldErrorsComponent } from './field-errors.component';

describe('FieldErrorsComponent', () => {
  let component: FieldErrorsComponent;
  let fixture: ComponentFixture<FieldErrorsComponent>;
  let injector: Injector;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldErrorsComponent],
    }).compileComponents();

    injector = TestBed.inject(Injector);
    fixture = TestBed.createComponent(FieldErrorsComponent);
    component = fixture.componentInstance;
  });

  function createRequiredForm() {
    const model = signal({ name: '' });
    const testForm = form(
      model,
      (p) => {
        required(p.name, { message: 'Name is required' });
      },
      { injector },
    );
    return testForm;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render no errors before the field is touched', () => {
    const testForm = createRequiredForm();
    fixture.componentRef.setInput('field', testForm.name);
    fixture.detectChanges();

    const errorEls = fixture.nativeElement.querySelectorAll('.form-field__error');
    expect(errorEls.length).toBe(0);
  });

  it('should render the error message once the field is touched and invalid', () => {
    const testForm = createRequiredForm();
    fixture.componentRef.setInput('field', testForm.name);
    testForm.name().markAsTouched();
    fixture.detectChanges();

    const errorEls = fixture.nativeElement.querySelectorAll('.form-field__error');
    expect(errorEls.length).toBe(1);
    expect(errorEls[0].textContent).toContain('Name is required');
    expect(errorEls[0].getAttribute('aria-live')).toBe('polite');
  });

  it('should clear errors once the value becomes valid', () => {
    const testForm = createRequiredForm();
    fixture.componentRef.setInput('field', testForm.name);
    testForm.name().markAsTouched();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.form-field__error').length).toBe(1);

    testForm.name().value.set('Valid Name');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.form-field__error').length).toBe(0);
  });
});

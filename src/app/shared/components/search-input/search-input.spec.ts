/**
 * Unit tests for SearchInputComponent.
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SearchInputComponent } from './search-input.component';

describe('SearchInputComponent', () => {
  let component: SearchInputComponent;
  let fixture: ComponentFixture<SearchInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchInputComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inputs', () => {
    it('should use default placeholder', () => {
      expect(component.placeholder()).toBe('Search...');
    });

    it('should use default debounce of 300ms', () => {
      expect(component.debounceMs()).toBe(300);
    });

    it('should default to not loading', () => {
      expect(component.loading()).toBe(false);
    });

    it('should default to not disabled', () => {
      expect(component.disabled()).toBe(false);
    });

    it('should default to empty value', () => {
      expect(component.value()).toBe('');
    });

    it('should display placeholder text', () => {
      fixture.componentRef.setInput('placeholder', 'Search tracks...');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      expect(input.getAttribute('placeholder')).toBe('Search tracks...');
    });
  });

  describe('Model (two-way binding)', () => {
    it('should update value model on input', () => {
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      input.value = 'test query';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component.value()).toBe('test query');
    });

    it('should reflect external model changes', () => {
      component.value.set('external value');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      expect(input.value).toBe('external value');
    });
  });

  describe('Debounced Search Output', () => {
    it('should emit search after debounce delay', fakeAsync(() => {
      fixture.detectChanges();

      let searchValue = '';
      component.searched.subscribe((value: string) => {
        searchValue = value;
      });

      const input = fixture.nativeElement.querySelector('.search-input__field');
      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      // Should not have emitted yet
      expect(searchValue).toBe('');

      // Advance past debounce
      tick(300);
      expect(searchValue).toBe('test');
    }));

    it('should debounce multiple rapid inputs', fakeAsync(() => {
      fixture.detectChanges();

      let emitCount = 0;
      let lastValue = '';
      component.searched.subscribe((value: string) => {
        emitCount++;
        lastValue = value;
      });

      const input = fixture.nativeElement.querySelector('.search-input__field');

      // Type rapidly
      input.value = 't';
      input.dispatchEvent(new Event('input'));
      tick(100);

      input.value = 'te';
      input.dispatchEvent(new Event('input'));
      tick(100);

      input.value = 'tes';
      input.dispatchEvent(new Event('input'));
      tick(100);

      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      // Should not have emitted intermediate values
      expect(emitCount).toBe(0);

      tick(300);
      expect(emitCount).toBe(1);
      expect(lastValue).toBe('test');
    }));
  });

  describe('Clear', () => {
    it('should show clear button when value is not empty', () => {
      component.value.set('search query');
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector('.search-input__clear');
      expect(clearBtn).toBeTruthy();
    });

    it('should hide clear button when value is empty', () => {
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector('.search-input__clear');
      expect(clearBtn).toBeFalsy();
    });

    it('should clear value and emit clear on button click', () => {
      component.value.set('search query');
      fixture.detectChanges();

      let clearEmitted = false;
      component.clear.subscribe(() => {
        clearEmitted = true;
      });

      const clearBtn = fixture.nativeElement.querySelector('.search-input__clear');
      clearBtn.click();
      fixture.detectChanges();

      expect(component.value()).toBe('');
      expect(clearEmitted).toBe(true);
    });

    it('should clear value on Escape key', () => {
      component.value.set('search query');
      fixture.detectChanges();

      let clearEmitted = false;
      component.clear.subscribe(() => {
        clearEmitted = true;
      });

      const input = fixture.nativeElement.querySelector('.search-input__field');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(component.value()).toBe('');
      expect(clearEmitted).toBe(true);
    });
  });

  describe('Loading State', () => {
    it('should show spinner icon when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.search-input__spinner');
      expect(spinner).toBeTruthy();
    });

    it('should show search icon when not loading', () => {
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.search-input__spinner');
      expect(spinner).toBeFalsy();
    });
  });

  describe('Disabled State', () => {
    it('should disable the input field', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      expect(input.disabled).toBe(true);
    });

    it('should add disabled class to container', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.search-input');
      expect(container.classList.contains('search-input--disabled')).toBe(true);
    });

    it('should hide clear button when disabled', () => {
      component.value.set('some value');
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector('.search-input__clear');
      expect(clearBtn).toBeFalsy();
    });
  });

  describe('Focus State', () => {
    it('should add focused class on focus', () => {
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      input.dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.search-input');
      expect(container.classList.contains('search-input--focused')).toBe(true);
    });

    it('should remove focused class on blur', () => {
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      input.dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.search-input');
      expect(container.classList.contains('search-input--focused')).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should set aria-label on input', () => {
      fixture.componentRef.setInput('ariaLabel', 'Search tracks');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('.search-input__field');
      expect(input.getAttribute('aria-label')).toBe('Search tracks');
    });

    it('should have aria-hidden on icon', () => {
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.search-input__icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have aria-label on clear button', () => {
      component.value.set('query');
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector('.search-input__clear');
      expect(clearBtn.getAttribute('aria-label')).toBe('Clear search');
    });
  });
});
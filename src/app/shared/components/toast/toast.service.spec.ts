/**
 * Unit tests for ToastService.
 */

import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty toasts', () => {
    expect(service.toasts().length).toBe(0);
    expect(service.hasToasts()).toBe(false);
  });

  describe('show()', () => {
    it('should add a toast to the queue', () => {
      service.show('Test message');

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Test message');
      expect(service.hasToasts()).toBe(true);
    });

    it('should default to info type', () => {
      service.show('Test message');

      expect(service.toasts()[0].type).toBe('info');
    });

    it('should default to 5000ms duration', () => {
      service.show('Test message');

      expect(service.toasts()[0].duration).toBe(5000);
    });

    it('should default to dismissible', () => {
      service.show('Test message');

      expect(service.toasts()[0].dismissible).toBe(true);
    });

    it('should prepend new toasts (newest first)', () => {
      service.show('First');
      service.show('Second');

      expect(service.toasts()[0].message).toBe('Second');
      expect(service.toasts()[1].message).toBe('First');
    });

    it('should accept custom options', () => {
      service.show('Custom message', {
        type: 'error',
        duration: 8000,
        dismissible: false,
      });

      const toast = service.toasts()[0];
      expect(toast.type).toBe('error');
      expect(toast.duration).toBe(8000);
      expect(toast.dismissible).toBe(false);
    });

    it('should generate unique IDs', () => {
      service.show('First');
      service.show('Second');

      expect(service.toasts()[0].id).not.toBe(service.toasts()[1].id);
    });

    it('should return a ToastRef with dismiss method', () => {
      const ref = service.show('Test');

      expect(ref.id).toBeTruthy();
      expect(typeof ref.dismiss).toBe('function');

      ref.dismiss();
      expect(service.toasts().length).toBe(0);
    });
  });

  describe('convenience methods', () => {
    it('success() should add success toast', () => {
      service.success('Success!');

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].type).toBe('success');
    });

    it('error() should add error toast', () => {
      service.error('Error!');

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].type).toBe('error');
    });

    it('warning() should add warning toast', () => {
      service.warning('Warning!');

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].type).toBe('warning');
    });

    it('info() should add info toast', () => {
      service.info('Info!');

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].type).toBe('info');
    });

    it('convenience methods should pass custom options', () => {
      service.error('Error!', { duration: 10000, dismissible: false });

      const toast = service.toasts()[0];
      expect(toast.duration).toBe(10000);
      expect(toast.dismissible).toBe(false);
    });
  });

  describe('dismiss()', () => {
    it('should remove a specific toast by ID', () => {
      service.show('First');
      service.show('Second');
      const id = service.toasts()[0].id;

      service.dismiss(id);

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].id).not.toBe(id);
    });

    it('should do nothing if ID does not exist', () => {
      service.show('Test');

      service.dismiss('non-existent-id');

      expect(service.toasts().length).toBe(1);
    });
  });

  describe('dismissAll()', () => {
    it('should remove all toasts', () => {
      service.show('First');
      service.show('Second');
      service.show('Third');

      service.dismissAll();

      expect(service.toasts().length).toBe(0);
      expect(service.hasToasts()).toBe(false);
    });

    it('should work with empty queue', () => {
      service.dismissAll();

      expect(service.toasts().length).toBe(0);
    });
  });

  describe('auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-dismiss after default duration', () => {
      service.show('Auto dismiss');
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(5000);
      expect(service.toasts().length).toBe(0);
    });

    it('should auto-dismiss after custom duration', () => {
      service.show('Custom duration', { duration: 2000 });
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(2000);
      expect(service.toasts().length).toBe(0);
    });

    it('should not auto-dismiss when duration is 0', () => {
      service.show('Persistent', { duration: 0 });

      vi.advanceTimersByTime(10000);
      expect(service.toasts().length).toBe(1);
    });
  });
});
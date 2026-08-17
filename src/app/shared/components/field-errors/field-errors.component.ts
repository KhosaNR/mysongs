import { Component, computed, input } from '@angular/core';
import type { FieldState, FieldTree } from '@angular/forms/signals';

/**
 * Shared inline validation error renderer for Signal Forms fields.
 *
 * Renders one `.form-field__error` line per active validation error on the
 * given field once the field has been touched (blurred or the form was
 * submitted). Error state updates reactively through Angular signals, so it
 * works under zoneless change detection with `OnPush` components.
 */
@Component({
  selector: 'app-field-errors',
  standalone: true,
  template: `
    @for (message of errorMessages(); track $index) {
      <span class="form-field__error" aria-live="polite">{{ message }}</span>
    }
  `,
})
export class FieldErrorsComponent {
  /** The Signal Forms field tree whose errors should be rendered. */
  readonly field = input.required<unknown>();

  readonly errorMessages = computed<string[]>(() => {
    const field = this.field();
    if (typeof field !== 'function') {
      return [];
    }

    const state = (field as FieldTree<unknown>)() as FieldState<unknown>;
    if (!state.touched() || !state.invalid()) {
      return [];
    }

    return state
      .errors()
      .map((error) => error.message)
      .filter((message): message is string => typeof message === 'string' && message.length > 0);
  });
}

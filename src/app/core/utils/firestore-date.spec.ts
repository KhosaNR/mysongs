import { describe, it, expect } from 'vitest';
import { toDateSafe, toDateInputValue } from './firestore-date';

describe('toDateSafe', () => {
  it('should pass through a valid Date', () => {
    const date = new Date('2020-05-17T00:00:00.000Z');
    expect(toDateSafe(date)?.toISOString()).toBe(date.toISOString());
  });

  it('should resolve a Firestore Timestamp via toDate()', () => {
    const date = new Date('2020-05-17T00:00:00.000Z');
    const timestamp = { toDate: () => date };
    expect(toDateSafe(timestamp)?.toISOString()).toBe(date.toISOString());
  });

  it('should return null for missing, invalid, or unresolvable values', () => {
    expect(toDateSafe(null)).toBeNull();
    expect(toDateSafe(undefined)).toBeNull();
    expect(toDateSafe('not-a-date')).toBeNull();
    expect(toDateSafe(new Date('invalid'))).toBeNull();
    expect(toDateSafe({ toDate: () => { throw new Error('boom'); } })).toBeNull();
    expect(toDateSafe({ seconds: 'nope' })).toBeNull();
  });
});

describe('toDateInputValue', () => {
  it('should format Dates and Timestamps for date inputs without throwing', () => {
    expect(toDateInputValue(new Date('2020-05-17T12:00:00.000Z'))).toBe('2020-05-17');
    expect(toDateInputValue({ toDate: () => new Date('2021-11-03T00:00:00.000Z') })).toBe(
      '2021-11-03',
    );
  });

  it('should return an empty string for missing or invalid values', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
  });
});

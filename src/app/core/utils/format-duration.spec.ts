/**
 * Unit tests for the platform's shared duration formatter.
 *
 * The hour field is omitted below one hour, per the duration standard in
 * `design-system.md`.
 */
import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('should omit hours below one hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(245)).toBe('4:05');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('should include hours at and above one hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7384)).toBe('2:03:04');
  });

  it('should zero-pad minutes and seconds', () => {
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('should collapse missing, negative and non-finite input to the placeholder', () => {
    expect(formatDuration(undefined)).toBe('0:00');
    expect(formatDuration(null)).toBe('0:00');
    expect(formatDuration(-10)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });

  it('should honour a custom placeholder for absent durations', () => {
    expect(formatDuration(undefined, '—')).toBe('—');
    expect(formatDuration(0, '—')).toBe('—');
    expect(formatDuration(Number.NaN, '—')).toBe('—');
    expect(formatDuration(245, '—')).toBe('4:05');
  });

  it('should floor fractional seconds', () => {
    expect(formatDuration(245.9)).toBe('4:05');
  });
});
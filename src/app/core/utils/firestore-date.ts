/**
 * Firestore date helpers.
 *
 * Firestore returns date fields as `Timestamp` objects (`{ seconds,
 * nanoseconds, toDate() }`), while the app writes plain `Date` instances.
 * Calling `new Date(timestamp)` on a Timestamp yields `Invalid Date`, and
 * `.toISOString()` then throws — which crashes dialog construction after the
 * backdrop has already opened. All date reads go through these helpers so a
 * Timestamp, Date, ISO string, or epoch millis resolves safely without
 * throwing.
 */

/** Firestore Timestamp shape (structural, avoids importing Firestore types). */
interface FirestoreTimestampLike {
  readonly toDate: () => Date;
}

/**
 * Resolves an unknown date-like value to a `Date`, or null when unresolvable.
 *
 * @param value - Date, Firestore Timestamp, ISO string, or epoch millis
 * @returns A valid Date, or null when the value is missing or invalid
 */
export function toDateSafe(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof (value as FirestoreTimestampLike).toDate === 'function') {
    try {
      const date = (value as FirestoreTimestampLike).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object') {
    const seconds = (value as { readonly seconds?: unknown }).seconds;
    if (typeof seconds === 'number') {
      const date = new Date(seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

/**
 * Formats a date-like value for `<input type="date">` (`yyyy-MM-dd).
 * Never throws — unresolvable values yield an empty string.
 *
 * @param value - Date, Firestore Timestamp, ISO string, or epoch millis
 * @returns Date input value, or an empty string when missing or invalid
 */
export function toDateInputValue(value: unknown): string {
  const date = toDateSafe(value);
  if (!date) {
    return '';
  }
  try {
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

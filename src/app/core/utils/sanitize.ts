/**
 * Recursively strips `undefined` values from an object tree.
 *
 * Firestore rejects `undefined` at any nesting depth for both `updateDoc()`
 * and `setDoc()`. Components frequently produce nested `undefined` values
 * (e.g. `socials.website: '' || undefined` or `releaseDate: undefined`),
 * so all document writes are sanitized through this helper.
 *
 * `null` is preserved — Firestore supports `null` (used for `deletedAt`
 * and `rejectionReason` clearances).
 *
 * @param value - The value to sanitize (objects are deep-cloned)
 * @returns A deep-cloned value with all `undefined` properties removed
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeForFirestore(nestedValue);
      if (cleaned !== undefined) {
        output[key] = cleaned;
      }
    }
    return output as T;
  }

  return value;
}
/**
 * Formats a duration in seconds as a clock string.
 *
 * Hours are included only once the duration reaches one hour, so a four-minute
 * track reads `4:05` while a feature reads `1:01:01`. Negative, non-finite and
 * missing inputs collapse to `0:00`.
 *
 * @param seconds - Duration in seconds
 * @returns Zero-padded clock string
 */
export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
/**
 * Builds the platform's song credits line.
 *
 * Every surface that shows a song's collaborators — track rows, the player queue
 * and the Now Playing tab — renders this one shape so the credit display cannot
 * drift between them. Segments are joined with ` | ` (not a bare space) so a
 * featured artist and a producer remain visually distinguishable.
 */

/** Minimum shape needed to derive a credits line. */
export interface CreditsSource {
  readonly featuredArtists?: string;
  readonly producers?: string;
  readonly writtenBy?: string;
}

/** A derived credits line. */
export interface SongCredits {
  /** Display text, empty when the song carries no credits at all. */
  readonly text: string;
  /** Whether a featured-artist and/or producer credit was present. */
  readonly hasCredits: boolean;
}

/**
 * Derives the credits line for a song.
 *
 * Falls back to the songwriters when there is neither a featured-artist nor a
 * producer credit, so the secondary row is never blank when data exists.
 *
 * @param song - Song or track carrying the credit fields
 * @returns The credits line and whether real credit segments were present
 */
export function formatSongCredits(song: CreditsSource): SongCredits {
  const parts: string[] = [];

  const featured = song.featuredArtists?.trim();
  if (featured) {
    parts.push(`feat. ${featured}`);
  }

  const producers = song.producers?.trim();
  if (producers) {
    parts.push(`Prod. ${producers}`);
  }

  if (parts.length > 0) {
    return { text: parts.join(' | '), hasCredits: true };
  }

  return { text: song.writtenBy?.trim() ?? '', hasCredits: false };
}
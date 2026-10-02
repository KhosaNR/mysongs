/**
 * Unit tests for the shared song credits formatter.
 *
 * The player queue, the Now Playing tab and `app-track-row` all render this
 * shape, so the separator and fallback behaviour are part of the platform
 * contract.
 */
import { formatSongCredits } from './format-credits';

describe('formatSongCredits', () => {
  it('should join featured artist and producer with a pipe separator', () => {
    const result = formatSongCredits({
      featuredArtists: 'Hopey.B',
      producers: 'Mr Ny',
      writtenBy: 'Bongani Mbhiza',
    });

    expect(result.text).toBe('feat. Hopey.B | Prod. Mr Ny');
    expect(result.hasCredits).toBe(true);
  });

  it('should render only the featured artist when no producer exists', () => {
    const result = formatSongCredits({ featuredArtists: 'Hopey.B' });

    expect(result.text).toBe('feat. Hopey.B');
    expect(result.hasCredits).toBe(true);
  });

  it('should render only the producer when no featured artist exists', () => {
    const result = formatSongCredits({ producers: 'Mr Ny' });

    expect(result.text).toBe('Prod. Mr Ny');
    expect(result.hasCredits).toBe(true);
  });

  it('should fall back to the songwriter when no credit segments exist', () => {
    const result = formatSongCredits({ writtenBy: 'Bongani Mbhiza' });

    expect(result.text).toBe('Bongani Mbhiza');
    expect(result.hasCredits).toBe(false);
  });

  it('should return an empty string when no credit data exists', () => {
    const result = formatSongCredits({});

    expect(result.text).toBe('');
    expect(result.hasCredits).toBe(false);
  });

  it('should ignore blank and whitespace-only credit values', () => {
    const result = formatSongCredits({
      featuredArtists: '   ',
      producers: '',
      writtenBy: 'Bongani Mbhiza',
    });

    expect(result.text).toBe('Bongani Mbhiza');
    expect(result.hasCredits).toBe(false);
  });

  it('should trim surrounding whitespace from credit values', () => {
    const result = formatSongCredits({ featuredArtists: '  Hopey.B  ' });

    expect(result.text).toBe('feat. Hopey.B');
  });
});
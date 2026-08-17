import { Song } from '../../shared/models/song.interface';
import { Track } from '../services/audio-player.service';

/**
 * Converts a Song into the player's Track shape.
 *
 * Centralizes the mapping so detail pages, explore, search, and playlist views
 * feed the global player consistent metadata (including the DB-sourced price).
 *
 * @param song - Song document to map
 * @param artistName - Resolved artist display name
 * @param albumTitle - Optional resolved album display name
 * @returns A Track ready for `AudioPlayerService`
 */
export function songToTrack(song: Song, artistName: string, albumTitle?: string): Track {
  return {
    id: song.songId,
    title: song.title,
    artist: artistName || 'Unknown Artist',
    artistId: song.artistId,
    albumId: song.albumId,
    albumTitle,
    streamUrl: song.streamUrl,
    artworkUrl: song.artworkUrl,
    duration: song.duration,
    lyrics: song.lyrics,
    youtubeVideoId: song.youtubeVideoId,
    priceZAR: song.priceZAR,
    minimumPriceZAR: song.minimumPriceZAR,
  };
}

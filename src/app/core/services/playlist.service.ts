import { Injectable, inject } from '@angular/core';
import { where } from '@angular/fire/firestore';
import { DbService } from './db.service';
import { ErrorHandler, Result } from '../utils/error-handler';
import { Playlist, PlaylistWithId } from '../../shared/models/playlist.interface';

/**
 * Service for listener playlist CRUD backed by the `playlists` collection.
 *
 * Firestore rules already restrict every operation to the playlist owner, so
 * this service only needs to bind the current user ID into the payloads and
 * keep dedup/ordering consistent.
 */
@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private readonly dbService = inject(DbService);
  private readonly errorHandler = inject(ErrorHandler);

  /**
   * Loads all playlists owned by the given user.
   *
   * @param userId - Public application user ID
   * @returns Result containing the user's playlists (empty array when none)
   */
  async getUserPlaylists(userId: string): Promise<Result<PlaylistWithId[]>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.getCollection<Playlist>('playlists', {
        constraints: [where('userId', '==', userId)],
      });

      if (result.isFailure()) {
        throw new Error(result.getError());
      }

      return result
        .getData()
        .map((doc) => ({ ...doc.data, id: doc.id }) as PlaylistWithId)
        .sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0));
    }, 'getUserPlaylists', { userId });
  }

  /**
   * Loads a single playlist by ID.
   *
   * @param playlistId - Playlist document ID
   * @returns Result containing the playlist (with its document ID)
   */
  async getPlaylist(playlistId: string): Promise<Result<PlaylistWithId>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.getDocument<Playlist>('playlists', playlistId);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
      const { id, data } = result.getData();
      return { ...data, id } as PlaylistWithId;
    }, 'getPlaylist', { playlistId });
  }

  /**
   * Creates a new playlist for the user.
   *
   * @param userId - Public application user ID
   * @param name - Playlist name
   * @param songIds - Initial song IDs (deduplicated)
   * @returns Result containing the new playlist document ID
   */
  async createPlaylist(userId: string, name: string, songIds: string[] = []): Promise<Result<string>> {
    return this.errorHandler.execute(async () => {
      const now = new Date();
      const id = this.dbService.generateId();
      const playlist: Playlist = {
        playlistId: id,
        userId,
        name: name.trim(),
        songIds: this.dedupe(songIds),
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.dbService.createWithId<Playlist>('playlists', id, playlist);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
      return id;
    }, 'createPlaylist', { userId });
  }

  /**
   * Updates playlist metadata (name/description).
   *
   * @param playlistId - Playlist document ID
   * @param data - Partial playlist fields to write
   * @returns Result indicating success or failure
   */
  async updatePlaylist(playlistId: string, data: Partial<Playlist>): Promise<Result<void>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.update<Playlist>('playlists', playlistId, {
        ...data,
        updatedAt: new Date(),
      });
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
    }, 'updatePlaylist', { playlistId });
  }

  /**
   * Deletes a playlist.
   *
   * @param playlistId - Playlist document ID
   * @returns Result indicating success or failure
   */
  async deletePlaylist(playlistId: string): Promise<Result<void>> {
    return this.errorHandler.execute(async () => {
      const result = await this.dbService.delete('playlists', playlistId);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
    }, 'deletePlaylist', { playlistId });
  }

  /**
   * Adds songs to the END of a playlist (deduplicated against existing IDs).
   *
   * @param playlistId - Playlist document ID
   * @param songIds - Song IDs to append
   * @returns Result indicating success or failure
   */
  async addSongs(playlistId: string, songIds: string[]): Promise<Result<void>> {
    return this.errorHandler.execute(async () => {
      const result = await this.getPlaylist(playlistId);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
      const playlist = result.getData();
      await this.dbService.update<Playlist>('playlists', playlistId, {
        songIds: this.dedupe([...playlist.songIds, ...songIds]),
        updatedAt: new Date(),
      });
    }, 'addSongs', { playlistId });
  }

  /**
   * Removes a song from a playlist.
   *
   * @param playlistId - Playlist document ID
   * @param songId - Song ID to remove
   * @returns Result indicating success or failure
   */
  async removeSong(playlistId: string, songId: string): Promise<Result<void>> {
    return this.errorHandler.execute(async () => {
      const result = await this.getPlaylist(playlistId);
      if (result.isFailure()) {
        throw new Error(result.getError());
      }
      const playlist = result.getData();
      await this.dbService.update<Playlist>('playlists', playlistId, {
        songIds: playlist.songIds.filter((id) => id !== songId),
        updatedAt: new Date(),
      });
    }, 'removeSong', { playlistId });
  }

  /**
   * Deduplicates an ordered list of song IDs while preserving order.
   *
   * @param ids - Raw song ID list
   * @returns Unique song IDs in their original order
   */
  private dedupe(ids: readonly string[]): string[] {
    return [...new Set(ids)];
  }
}

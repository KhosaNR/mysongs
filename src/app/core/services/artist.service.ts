import { Injectable, inject } from '@angular/core';
import { ErrorHandler, Result } from '../utils/error-handler';
import { DbService } from './db.service';
import { UserService } from './user.service';
import { User } from '../../shared/models/user.interface';
import { Artist } from '../../shared/models/artist.interface';

export interface ArtistApplication {
  readonly user: User;
  readonly artist: Artist;
}

@Injectable({ providedIn: 'root' })
export class ArtistService {
  private readonly dbService = inject(DbService);
  private readonly userService = inject(UserService);
  private readonly errorHandler = inject(ErrorHandler);

  async getPendingApplications(): Promise<Result<ArtistApplication[]>> {
    return this.errorHandler.execute(
      async () => {
        const usersResult = await this.dbService.getCollection<User>('users', {
          constraints: [],
        });
        if (usersResult.isFailure()) {
          throw new Error(usersResult.getError());
        }

        const pendingUsers = usersResult
          .getData()
          .map((doc) => doc.data)
          .filter((user) => user.role === 'artist' && user.artistStatus === 'pending');

        const applications: ArtistApplication[] = [];
        for (const user of pendingUsers) {
          const artistId = user.artistId;
          const artistResult = artistId
            ? await this.dbService.getDocument<Artist>('artists', artistId)
            : null;

          if (artistResult?.isSuccess()) {
            applications.push({ user, artist: artistResult.getData().data });
          } else {
            // Artist doc missing or unreadable — still include the pending user
            // with a minimal artist profile so the admin can act on it.
            applications.push({
              user,
              artist: {
                artistId: artistId ?? user.id,
                name: user.displayName ?? 'Unnamed Artist',
                userId: user.id,
                artistStatus: 'pending',
              } as Artist,
            });
          }
        }

        return applications;
      },
      'getPendingApplications',
      {}
    );
  }

  async approveArtist(userId: string, artistId: string, displayName?: string): Promise<Result<void>> {
    return this.errorHandler.execute(
      async () => {
        await this.userService.updateUserDocument(userId, {
          artistStatus: 'approved',
          artistId,
          rejectionReason: null,
        } as Partial<User>);

        // Ensure the artist workspace exists before updating its status.
        const existsResult = await this.dbService.exists('artists', artistId);
        if (existsResult.isFailure()) {
          throw new Error(existsResult.getError());
        }

        if (!existsResult.getData()) {
          await this.dbService.createWithId('artists', artistId, {
            artistId,
            name: displayName ?? 'Unnamed Artist',
            userId,
            artistStatus: 'approved',
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeleted: false,
          } as Artist);
        } else {
          await this.dbService.update('artists', artistId, {
            artistStatus: 'approved',
            updatedAt: new Date(),
          } as Partial<Artist>);
        }
      },
      'approveArtist',
      { artistId }
    );
  }

  async rejectArtist(userId: string, artistId: string, reason: string): Promise<Result<void>> {
    return this.errorHandler.execute(
      async () => {
        await this.userService.updateUserDocument(userId, {
          artistStatus: 'rejected',
          rejectionReason: reason,
        } as Partial<User>);

        await this.dbService.update('artists', artistId, {
          artistStatus: 'rejected',
          updatedAt: new Date(),
        } as Partial<Artist>);
      },
      'rejectArtist',
      { artistId }
    );
  }

  async suspendArtist(userId: string, artistId: string, reason: string): Promise<Result<void>> {
    return this.errorHandler.execute(
      async () => {
        await this.userService.updateUserDocument(userId, {
          artistStatus: 'suspended',
          rejectionReason: reason,
        } as Partial<User>);

        await this.dbService.update('artists', artistId, {
          artistStatus: 'suspended',
          updatedAt: new Date(),
        } as Partial<Artist>);
      },
      'suspendArtist',
      { artistId }
    );
  }

  async restoreArtist(userId: string, artistId: string, displayName?: string): Promise<Result<void>> {
    return this.errorHandler.execute(
      async () => {
        await this.userService.updateUserDocument(userId, {
          artistStatus: 'approved',
          artistId,
          rejectionReason: null,
        } as Partial<User>);

        // Ensure the artist workspace exists before updating its status.
        const existsResult = await this.dbService.exists('artists', artistId);
        if (existsResult.isFailure()) {
          throw new Error(existsResult.getError());
        }

        if (!existsResult.getData()) {
          await this.dbService.createWithId('artists', artistId, {
            artistId,
            userId,
            name: displayName ?? 'Unnamed Artist',
            artistStatus: 'approved',
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeleted: false,
          } as Artist);
        } else {
          await this.dbService.update('artists', artistId, {
            artistStatus: 'approved',
            updatedAt: new Date(),
          } as Partial<Artist>);
        }
      },
      'restoreArtist',
      { artistId }
    );
  }
}
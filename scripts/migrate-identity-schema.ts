/**
 * Identity schema migration script for My Songs.
 *
 * Re-keys legacy Firestore documents from Firebase Auth UIDs to opaque
 * application IDs, following the decoupled identity schema:
 *   - `users/{uid}`  ->  `users/{newUserId}` (adds `userId` + `authUid`, creates lookup)
 *   - `artists/{oldId}`  ->  `artists/{newArtistId}` (adds `userId`, replaces `artistId`)
 *   - Content and ledger `userId`/`artistId` references are rewritten in-place.
 *
 * This script supersedes `backfill-artist-id.ts`. Do NOT run both.
 *
 * @runbook npx tsx scripts/migrate-identity-schema.ts [--dry-run]
 * @example
 *   npx tsx scripts/migrate-identity-schema.ts --dry-run   # preview only
 *   npx tsx scripts/migrate-identity-schema.ts             # apply changes
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { environment } from '../src/environments/environment';
import { resolveServiceAccount, resolveTargetEnv } from './lib/service-account';

type UserRecord = FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>;

interface UserDoc {
  userId?: string;
  authUid?: string;
  email?: string | null;
  displayName?: string | null;
  role?: string;
  artistId?: string | null;
  artistStatus?: string | null;
  rejectionReason?: string | null;
  consent?: Record<string, unknown>;
  createdAt?: FirebaseFirestore.FieldValue | string | Date;
  updatedAt?: FirebaseFirestore.FieldValue | string | Date;
}

interface ArtistDoc {
  artistId: string;
  userId?: string;
  name: string;
  artistStatus?: string;
  createdAt?: FirebaseFirestore.FieldValue | string | Date;
  updatedAt?: FirebaseFirestore.FieldValue | string | Date;
  isDeleted?: boolean;
}

interface PurchaseDoc {
  userId: string;
  artistId: string;
  purchaseType: string;
  songId?: string;
  albumId?: string;
  songIds?: string[];
  status: string;
}

interface PlaylistDoc {
  userId: string;
}

interface SongDoc {
  artistId: string;
}

interface AlbumDoc {
  artistId: string;
}

interface SponsorDoc {
  artistId: string;
}

const BATCH_LIMIT = 500;

async function initializeFirebase(): Promise<FirebaseFirestore.Firestore> {
  const serviceAccount = await resolveServiceAccount(resolveTargetEnv());
  if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error('Service account not found. Ensure firebaseServiceAccount exists for the target environment or set GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const app = initializeApp({
    credential: cert(serviceAccount as Record<string, unknown>),
  });
  return getFirestore(app);
}

function autoId(db: FirebaseFirestore.Firestore): string {
  return db.collection('_ids').doc().id;
}

function logAction(action: string, detail: string, dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run]' : '[apply]';
  console.log(`  ${prefix} ${action}: ${detail}`);
}

async function migrateUsers(db: FirebaseFirestore.Firestore, dryRun: boolean): Promise<{ oldId: string; newId: string }[]> {
  const snapshot = await db.collection('users').get();
  const rekeyed: { oldId: string; newId: string }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as UserDoc;
    if (data.userId && typeof data.userId === 'string' && data.userId.length > 0) {
      continue;
    }

    const oldId = doc.id;
    const newId = autoId(db);
    const authUid = oldId;

    logAction('user rekey', `${oldId} -> ${newId}`, dryRun);

    if (!dryRun) {
      const newData: Record<string, unknown> = {
        ...data,
        userId: newId,
        authUid,
      };
      delete (newData as Record<string, unknown>).id;

      const batch = db.batch();
      const newRef = db.collection('users').doc(newId);
      batch.set(newRef, newData);

      const lookupRef = db.collection('user_auth_lookup').doc(authUid);
      batch.set(lookupRef, { userId: newId, createdAt: new Date() }, { merge: true });

      batch.delete(doc.ref);
      await batch.commit();
    }

    rekeyed.push({ oldId, newId });
  }

  return rekeyed;
}

async function migrateArtists(db: FirebaseFirestore.Firestore, userMap: Map<string, string>, dryRun: boolean): Promise<{ oldId: string; newId: string }[]> {
  const snapshot = await db.collection('artists').get();
  const rekeyed: { oldId: string; newId: string }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as ArtistDoc;
    if (!data.artistId || data.artistId.length === 0) {
      continue;
    }

    const oldId = doc.id;
    const newId = autoId(db);
    const legacyOwnerUid = (data as unknown as Record<string, unknown>).ownerUid as string | undefined;
    const docUserId = (data as unknown as Record<string, unknown>).userId as string | undefined;
    const ownerUid = legacyOwnerUid || docUserId || oldId;
    const userId = userMap.get(ownerUid) || ownerUid;

    logAction('artist rekey', `${oldId} -> ${newId} (owner ${userId})`, dryRun);

    if (!dryRun) {
      const newData: Record<string, unknown> = {
        ...data,
        artistId: newId,
        userId,
      };
      delete (newData as Record<string, unknown>).id;

      const batch = db.batch();
      const newRef = db.collection('artists').doc(newId);
      batch.set(newRef, newData);
      batch.delete(doc.ref);
      await batch.commit();
    }

    rekeyed.push({ oldId, newId });
  }

  return rekeyed;
}
async function rewriteReferences(db: FirebaseFirestore.Firestore, userMap: Map<string, string>, artistMap: Map<string, string>, dryRun: boolean): Promise<void> {
  const collections: Array<{ path: string; key: string; type: 'user' | 'artist'; field: string }> = [
    { path: 'songs', key: 'songId', type: 'artist', field: 'artistId' },
    { path: 'albums', key: 'albumId', type: 'artist', field: 'artistId' },
    { path: 'sponsors', key: 'sponsorId', type: 'artist', field: 'artistId' },
    { path: 'playlists', key: 'playlistId', type: 'user', field: 'userId' },
  ];

  for (const col of collections) {
    const snapshot = await db.collection(col.path).get();
    let touched = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const raw = data[col.field];

      if (col.type === 'user' && typeof raw === 'string') {
        const mapped = userMap.get(raw);
        if (mapped && mapped !== raw) {
          logAction(col.path, `${doc.id}: ${col.field} ${raw} -> ${mapped}`, dryRun);
          touched++;
          if (!dryRun) {
            await doc.ref.update({ [col.field]: mapped });
          }
        }
      } else if (col.type === 'artist' && typeof raw === 'string') {
        const mapped = artistMap.get(raw);
        if (mapped && mapped !== raw) {
          logAction(col.path, `${doc.id}: ${col.field} ${raw} -> ${mapped}`, dryRun);
          touched++;
          if (!dryRun) {
            await doc.ref.update({ [col.field]: mapped });
          }
        }
      }
    }

    if (touched === 0) {
      console.log(`  ${dryRun ? '[dry-run]' : '[apply]'} ${col.path}: no ${col.field} references to rewrite`);
    }
  }

  const ledgerSnapshot = await db.collection('purchases_ledger').get();
  let ledgerTouched = 0;

  for (const doc of ledgerSnapshot.docs) {
    const data = doc.data() as PurchaseDoc & Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    let changed = false;

    const rawUserId = data.userId;
    if (typeof rawUserId === 'string') {
      const newUserId = userMap.get(rawUserId);
      if (newUserId && newUserId !== rawUserId) {
        updates.userId = newUserId;
        changed = true;
      }
    }

    const rawArtistId = data.artistId;
    if (typeof rawArtistId === 'string') {
      const newArtistId = artistMap.get(rawArtistId);
      if (newArtistId && newArtistId !== rawArtistId) {
        updates.artistId = newArtistId;
        changed = true;
      }
    }

    // Note: `songIds`/`albumId` reference songs/albums documents, which are NOT
    // re-keyed by this migration; leaving them as-is keeps ledger rows consistent.

    if (changed) {
      logAction('purchases_ledger', `${doc.id}: rewrite userId/artistId refs`, dryRun);
      ledgerTouched++;
      if (!dryRun) {
        await doc.ref.update(updates);
      }
    }
  }

  if (ledgerTouched === 0) {
    console.log(`  ${dryRun ? '[dry-run]' : '[apply]'} purchases_ledger: no references to rewrite`);
  }
}

/**
 * Rewrites the stale `artistId` field on user documents after artists have been
 * re-keyed. Runs LAST so the completed artistMap (old -> new) is available.
 *
 * @param db - Firestore instance
 * @param artistMap - Mapping of old artist ids to new opaque artist ids
 * @param dryRun - When true, only prints planned changes
 */
async function rewriteUserArtistIds(db: FirebaseFirestore.Firestore, artistMap: Map<string, string>, dryRun: boolean): Promise<void> {
  const snapshot = await db.collection('users').get();
  let touched = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as UserDoc;
    const rawArtistId = data.artistId;
    if (typeof rawArtistId !== 'string' || rawArtistId.length === 0) {
      continue;
    }

    const mapped = artistMap.get(rawArtistId);
    if (mapped && mapped !== rawArtistId) {
      logAction('users', `${doc.id}: artistId ${rawArtistId} -> ${mapped}`, dryRun);
      touched++;
      if (!dryRun) {
        await doc.ref.update({ artistId: mapped });
      }
    }
  }

  if (touched === 0) {
    console.log(`  ${dryRun ? '[dry-run]' : '[apply]'} users: no artistId references to rewrite`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  try {
    const db = await initializeFirebase();

    console.log(`Migrating identity schema (${dryRun ? 'DRY RUN' : 'APPLY'})...`);
    console.log();

    const userRekeyed = await migrateUsers(db, dryRun);
    console.log(`Users: ${userRekeyed.length} document(s) ${dryRun ? 'would be' : 'were'} rekeyed.`);

    const userMap = new Map<string, string>();
    for (const entry of userRekeyed) {
      userMap.set(entry.oldId, entry.newId);
    }

    const artistRekeyed = await migrateArtists(db, userMap, dryRun);
    console.log(`Artists: ${artistRekeyed.length} document(s) ${dryRun ? 'would be' : 'were'} rekeyed.`);

    const artistMap = new Map<string, string>();
    for (const entry of artistRekeyed) {
      artistMap.set(entry.oldId, entry.newId);
    }

    console.log();
    console.log('Rewriting references in content, ledger, and user documents...');
    await rewriteReferences(db, userMap, artistMap, dryRun);
    await rewriteUserArtistIds(db, artistMap, dryRun);

    console.log();
    console.log(`Migration ${dryRun ? 'dry-run complete - no data was modified' : 'complete'}.`);
    console.log('Affected users should sign out and sign back in (or refresh) to pick up the new IDs.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();


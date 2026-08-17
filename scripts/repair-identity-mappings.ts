/**
 * Repair script for identity mappings after the identity-schema migration.
 *
 * `migrate-identity-schema.ts` re-keys `users` and `artists` and rewrites
 * `artistId`/`userId` references in content and ledger collections, but it
 * never rewrites the `artistId` field on user documents, so those still point
 * at the OLD artist id (e.g. `leobee_01`) after migration. This script
 * rebuilds the user <-> artist <-> auth linkage from the current (post-migration)
 * Firestore state:
 *
 *   - `artists/{artistId}.userId`  — owner's public user id (canonical)
 *   - `user_auth_lookup/{authUid}`  — Firebase Auth UID -> public user id
 *   - `users/{userId}.artistId`     — rewritten to the current artist doc id
 *
 * It also re-syncs Firebase custom claims for artist owners and reports stale
 * legacy `users/{uid}` duplicates (optionally prunes them with --prune-stale).
 *
 * @runbook
 *   npx tsx scripts/repair-identity-mappings.ts --dry-run          # preview only
 *   npx tsx scripts/repair-identity-mappings.ts                    # apply fixes
 *   npx tsx scripts/repair-identity-mappings.ts --prune-stale      # also delete legacy dupes
 *
 * @file Supersedes the broken `fix-user-artistids.ts` (deleted 2026-08-09).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { environment } from '../src/environments/environment';
import { resolveServiceAccount, resolveTargetEnv } from './lib/service-account';

interface ArtistRecord {
  artistId?: string;
  userId?: string;
  ownerUid?: string;
  artistStatus?: string;
}

interface UserRecord {
  userId?: string;
  authUid?: string;
  role?: string;
  artistId?: string | null;
  artistStatus?: string;
}

async function initializeFirebase(): Promise<{ auth: Auth; db: Firestore }> {
  const serviceAccount = await resolveServiceAccount(resolveTargetEnv());
  if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error('Service account not found. Ensure firebaseServiceAccount exists for the target environment or set GOOGLE_APPLICATION_CREDENTIALS.');
  }
  const app = initializeApp({
    credential: cert(serviceAccount as Record<string, unknown>),
  });
  return { auth: getAuth(app), db: getFirestore(app) };
}

function logAction(action: string, detail: string, dryRun: boolean): void {
  console.log(`  ${dryRun ? '[dry-run]' : '[apply]'} ${action}: ${detail}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const pruneStale = process.argv.includes('--prune-stale');

  try {
    const { auth, db } = await initializeFirebase();

    console.log(`Repairing identity mappings (${dryRun ? 'DRY RUN' : 'APPLY'})...`);
    console.log();

    // Index 1: artists (canonical). Keep the raw `userId`/`ownerUid` hints.
    const artistsSnapshot = await db.collection('artists').get();
    const artistList = artistsSnapshot.docs.map((doc) => {
      const data = doc.data() as ArtistRecord;
      const hints = [data.userId, data.ownerUid, data.artistId].filter((v): v is string => !!v);
      return { docId: doc.id, data, hints, resolvedOwner: null as string | null };
    });

    // Index 2: auth -> public user id mapping.
    const lookupSnapshot = await db.collection('user_auth_lookup').get();
    const userIdByAuthUid = new Map<string, string>();
    for (const doc of lookupSnapshot.docs) {
      const userId = doc.data().userId as string | undefined;
      if (userId) {
        userIdByAuthUid.set(doc.id, userId);
      }
    }
    const authUidByUserId = new Map<string, string>();
    for (const [authUid, userId] of userIdByAuthUid) {
      authUidByUserId.set(userId, authUid);
    }
    // Index 3: users.
    const usersSnapshot = await db.collection('users').get();
    const userDocs = new Map<string, UserRecord>();
    for (const doc of usersSnapshot.docs) {
      userDocs.set(doc.id, { ...(doc.data() as UserRecord) });
    }

    // Pass A — resolve owners that reference a known user key or auth UID.
    for (const artist of artistList) {
      for (const hint of artist.hints) {
        const mapped = userIdByAuthUid.get(hint);
        if (mapped && userDocs.has(mapped)) {
          artist.resolvedOwner = mapped;
          break;
        }
        if (userDocs.has(hint)) {
          artist.resolvedOwner = hint;
          break;
        }
        if (mapped) {
          artist.resolvedOwner = mapped;
          break;
        }
      }
    }

    // Pass B — link artists whose owner hint is a stale/legacy slug (e.g.
    // `leobee_01`) to the user whose current artistId field still holds it.
    for (const artist of artistList) {
      if (artist.resolvedOwner) {
        continue;
      }
      for (const hint of artist.hints) {
        const linkedUser = [...userDocs.entries()].find(([, user]) => user.artistId === hint);
        if (linkedUser) {
          artist.resolvedOwner = linkedUser[0];
          console.log(`  \u2514 matched artists/${artist.docId} hint '${hint}' -> users/${linkedUser[0]}`);
          break;
        }
      }
    }

    let usersFixed = 0;
    let artistDocsFixed = 0;
    let claimsUpdated = 0;

    for (const { docId: artistId, data, resolvedOwner: ownerPublicId } of artistList) {
      if (!ownerPublicId) {
        console.log(`  \u26a0 artists/${artistId}: cannot resolve owner (missing userId/ownerUid)`);
        continue;
      }

      // Keep the artist doc's owner reference canonical.
      if (data.userId && data.userId !== ownerPublicId) {
        logAction('artist', `artists/${artistId}: userId ${data.userId} -> ${ownerPublicId}`, dryRun);
        artistDocsFixed++;
        if (!dryRun) {
          await db.collection('artists').doc(artistId).update({ userId: ownerPublicId });
          data.userId = ownerPublicId;
        }
      }

      const userDoc = userDocs.get(ownerPublicId);
      const updates: Record<string, unknown> = {};

      if (!userDoc) {
        logAction('create user', `users/${ownerPublicId} <- artists/${artistId}`, dryRun);
        usersFixed++;
        if (!dryRun) {
          const now = new Date();
          await db.collection('users').doc(ownerPublicId).set({
            userId: ownerPublicId,
            role: 'artist',
            artistId,
            artistStatus: data.artistStatus || 'approved',
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        if (userDoc.artistId !== artistId) {
          updates.artistId = artistId;
        }
        if (!userDoc.role || userDoc.role === 'listener') {
          updates.role = 'artist';
        }
        if (!userDoc.artistStatus || userDoc.artistStatus === 'pending') {
          updates.artistStatus = data.artistStatus || 'approved';
        }
        if (Object.keys(updates).length > 0) {
          logAction('user', `users/${ownerPublicId}: ${Object.keys(updates).join(', ')}`, dryRun);
          usersFixed++;
          if (!dryRun) {
            await db.collection('users').doc(ownerPublicId).update({ ...updates, updatedAt: new Date() });
          }
        }
      }

      // Keep the in-memory index in sync so the claims pass uses fresh data.
      if (!userDoc) {
        userDocs.set(ownerPublicId, {
          userId: ownerPublicId,
          role: 'artist',
          artistId,
          artistStatus: data.artistStatus || 'approved',
        });
      } else if (Object.keys(updates).length > 0) {
        userDocs.set(ownerPublicId, { ...userDoc, ...updates });
      }
    }

    // Reconcile custom claims for ALL users. Rules use claims-only admin checks
    // and the userId claim, so this pass guarantees rules never need a
    // cross-document get() to resolve identity. Tokens refresh on next sign-in.
    for (const [userId, user] of userDocs) {
      const authUid = authUidByUserId.get(userId);
      if (!authUid) {
        continue;
      }
      const claims: Record<string, unknown> = { role: user.role ?? 'listener', userId };
      if (user.role === 'artist' && user.artistId) {
        claims.artistId = user.artistId;
      }
      logAction('claims', `${authUid}: ${JSON.stringify(claims)}`, dryRun);
      claimsUpdated++;
      if (!dryRun) {
        try {
          await auth.setCustomUserClaims(authUid, claims);
        } catch (error) {
          // Stale user doc/lookup whose Firebase Auth record no longer exists.
          console.warn(`  ⚠ claims for ${authUid} skipped: ${(error as Error).message}`);
        }
      }
    }

    // Reverse scan — users whose role/artistId points at a missing artist doc.
    const existingArtistIds = new Set(artistList.map((a) => a.docId));
    let dangling = 0;
    for (const [userId, user] of userDocs) {
      if (user.role === 'artist' && user.artistId && !existingArtistIds.has(user.artistId)) {
        console.log(`  \u26a0 users/${userId}: artistId '${user.artistId}' has no matching artists doc (stale or unlinked)`);
        dangling++;
      }
    }

    // Stale legacy users/{authUid} duplicates (created by the old set-user-role).
    const staleLegacy: string[] = [];
    for (const [authUid, userId] of userIdByAuthUid) {
      if (authUid !== userId && userDocs.has(authUid) && userDocs.has(userId)) {
        staleLegacy.push(authUid);
      }
    }
    let staleDeleted = 0;
    if (staleLegacy.length > 0) {
      console.log();
      console.log(`Found ${staleLegacy.length} stale legacy user document(s): ${staleLegacy.join(', ')}`);
      if (pruneStale) {
        for (const authUid of staleLegacy) {
          logAction('delete stale legacy user', `users/${authUid}`, dryRun);
          staleDeleted++;
          if (!dryRun) {
            await db.collection('users').doc(authUid).delete();
            userDocs.delete(authUid);
          }
        }
      } else {
        console.log('Rerun with --prune-stale to delete them once you confirm the canonical docs are healthy.');
      }
    }

    console.log();
    console.log(`Artists indexed: ${artistList.length}`);
    console.log(`Users repaired: ${usersFixed}`);
    console.log(`Artist docs owner-fixed: ${artistDocsFixed}`);
    console.log(`Custom claims synced: ${claimsUpdated}`);
    console.log(`Dangling artistIds: ${dangling}`);
    console.log(`Stale legacy users: ${staleLegacy.length} (${staleDeleted} deleted)`);
    console.log();
    console.log('Affected users should sign out and sign back in (or refresh) to pick up the new mappings.');
  } catch (error) {
    console.error('Repair failed:', error);
    process.exit(1);
  }
}

main();

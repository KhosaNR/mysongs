/**
 * Backfills the flattened song document schema.
 *
 * Songs previously stored attribution under a nested `credits` object
 * (`credits.writtenBy`, `credits.producedBy`, `credits.mixedMasteredBy`).
 * This script:
 *   1. Promotes `credits.writtenBy` to the top-level `writtenBy` field.
 *   2. Removes the legacy nested `credits` object.
 *   3. Backfills `producers` (from the produced-by value) and `featuredArtists`
 *      (from a per-catalog map) where they were never written.
 *
 * The legacy `producedBy` / `mixedMasteredBy` top-level fields are no longer
 * part of the song schema and are deliberately not promoted.
 *
 * Existing top-level values are never overwritten — only missing fields are set.
 *
 * @runbook
 *   npx tsx scripts/backfill-song-credits.ts --dry-run   # preview only
 *   npx tsx scripts/backfill-song-credits.ts             # apply changes
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, DocumentReference } from 'firebase-admin/firestore';
import { environment } from '../src/environments/environment';
import { resolveServiceAccount, resolveTargetEnv } from './lib/service-account';

const BATCH_LIMIT = 400;

/**
 * Featured artists for the seeded Ku Langhe Mbilu catalog, keyed by songId.
 * The legacy song documents never stored these, so they are applied only when
 * the field is currently missing.
 */
const CATALOG_FEATURED_ARTISTS: Record<string, string> = {
  track_001: 'Hopey.B, Nay (THA)',
  track_006: 'C-Siders',
  track_007: 'Mellow Kid, CVP The Problem',
  track_008: 'Clein Buoy',
  track_012: 'Hopey.B, T-Chandler',
  track_013: 'Hopey.B',
  track_014: 'Mellow Kid',
  track_015: 'MRM',
  track_016: 'West Heidik',
};

interface LegacyCredits {
  readonly writtenBy?: string;
  readonly producedBy?: string;
  readonly mixedMasteredBy?: string;
}

async function initializeFirebase(): Promise<Firestore> {
  const serviceAccount = await resolveServiceAccount(resolveTargetEnv());
  if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error('Service account not found. Ensure firebaseServiceAccount exists for the target environment or set GOOGLE_APPLICATION_CREDENTIALS.');
  }
  const app = initializeApp({
    credential: cert(serviceAccount as Record<string, unknown>),
  });
  return getFirestore(app);
}

function logAction(action: string, detail: string, dryRun: boolean): void {
  console.log(`  ${dryRun ? '[dry-run]' : '[apply]'} ${action}: ${detail}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  try {
    const db = await initializeFirebase();
    const snapshot = await db.collection('songs').get();

    console.log(`Backfilling flattened song credits (${dryRun ? 'DRY RUN' : 'APPLY'})...`);
    console.log();

    const pending = new Map<DocumentReference, Record<string, unknown>>();
    let totalTouched = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const credits = data.credits as LegacyCredits | undefined;
      const featuredArtists = CATALOG_FEATURED_ARTISTS[doc.id];

      const update: Record<string, unknown> = {};

      if (credits) {
        if (!data.writtenBy && credits.writtenBy) update.writtenBy = credits.writtenBy;
        update.credits = FieldValue.delete();
      }

      if (!data.producers) {
        const producer = (data.producedBy as string | undefined) ?? credits?.producedBy;
        if (producer) update.producers = producer;
      }

      if (featuredArtists && !data.featuredArtists) {
        update.featuredArtists = featuredArtists;
      }

      if (Object.keys(update).length === 0) continue;

      totalTouched++;
      logAction(`songs/${doc.id}`, Object.keys(update).join(', '), dryRun);
      pending.set(doc.ref, update);
    }

    if (!dryRun) {
      let batch = db.batch();
      let count = 0;
      for (const [ref, update] of pending) {
        batch.update(ref, update);
        count++;
        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    }

    console.log();
    console.log(`Songs updated: ${totalTouched}/${snapshot.size} (${dryRun ? 'would be updated' : 'updated'})`);
    if (dryRun) {
      console.log('Re-run without --dry-run to apply.');
    }
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

main();

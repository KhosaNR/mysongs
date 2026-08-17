/**
 * Backfills `isDeleted: false` on catalog documents (artists/albums/songs) so
 * public list queries can exclude soft-deleted content server-side with
 * `where('isDeleted', '==', false)`.
 *
 * Firestore equality/inequality filters do NOT match documents where the field
 * is missing, so documents that predate the soft-delete feature would silently
 * disappear from public queries. This script guarantees every document carries
 * the field before the queries start filtering on it.
 *
 * @runbook
 *   npx tsx scripts/backfill-isdeleted.ts --dry-run   # preview only
 *   npx tsx scripts/backfill-isdeleted.ts             # apply changes
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { environment } from '../src/environments/environment';
import { resolveServiceAccount, resolveTargetEnv } from './lib/service-account';

const BATCH_LIMIT = 400;

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
  const collections = ['artists', 'albums', 'songs'];

  try {
    const db = await initializeFirebase();

    console.log(`Backfilling isDeleted (${dryRun ? 'DRY RUN' : 'APPLY'})...`);
    console.log();

    let totalTouched = 0;
    let totalMissing = 0;

    for (const col of collections) {
      const snapshot = await db.collection(col).get();
      const affected = snapshot.docs.filter((d) => d.data().isDeleted == null);

      if (affected.length === 0) {
        console.log(`  ${col}: all ${snapshot.size} document(s) already carry isDeleted`);
        continue;
      }

      console.log(`  ${col}: ${affected.length}/${snapshot.size} document(s) missing isDeleted`);
      for (const d of affected) {
        logAction(`${col}/${d.id}`, 'set isDeleted=false', dryRun);
      }

      totalMissing += affected.length;
      totalTouched += affected.length;

      if (!dryRun) {
        for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
          const batch = db.batch();
          affected.slice(i, i + BATCH_LIMIT).forEach((d) => {
            batch.update(d.ref, { isDeleted: false });
          });
          await batch.commit();
        }
      }
    }

    console.log();
    console.log(`Missing isDeleted fields: ${totalMissing} (${dryRun ? 'would be fixed' : 'fixed'})`);
    if (dryRun) {
      console.log('Dry-run complete - no data was modified. Rerun without --dry-run to apply.');
    } else {
      console.log('Backfill complete. Public list queries can now filter with where(\'isDeleted\', \'==\', false).');
    }
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

main();

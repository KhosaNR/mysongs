/**
 * Migrates all content (songs/albums/sponsors) from one artist document to
 * another, then optionally retires the source artist. Intended to consolidate
 * the legacy seed artist (e.g. ex-`leobee_01`) into the registered artist
 * workspace created by the app's register flow after the identity-schema
 * migration left both in the database.
 *
 * NOTE: `purchases_ledger` rows are intentionally never rewritten - they are
 * an immutable audit trail of historical transactions.
 *
 * @runbook
 *   npx tsx scripts/merge-artist-content.ts <sourceArtistId> <targetArtistId> [--retire-source] [--dry-run]
 * @example
 *   npx tsx scripts/merge-artist-content.ts lUkiKml9Qovcgv0zBePc qEu0AJjNMwCUgt9zuOjk --dry-run
 *   npx tsx scripts/merge-artist-content.ts lUkiKml9Qovcgv0zBePc qEu0AJjNMwCUgt9zuOjk --retire-source
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
  const [, , fromIdArg, toIdArg] = process.argv;
  const dryRun = process.argv.includes('--dry-run');
  const retireSource = process.argv.includes('--retire-source');

  if (!fromIdArg || !toIdArg || fromIdArg === toIdArg) {
    console.error('Usage: npx tsx scripts/merge-artist-content.ts <sourceArtistId> <targetArtistId> [--retire-source] [--dry-run]');
    process.exit(1);
  }

  try {
    const db = await initializeFirebase();

    const fromDoc = await db.collection('artists').doc(fromIdArg).get();
    const toDoc = await db.collection('artists').doc(toIdArg).get();
    if (!fromDoc.exists) throw new Error(`Source artist '${fromIdArg}' not found`);
    if (!toDoc.exists) throw new Error(`Target artist '${toIdArg}' not found`);

    console.log(`Merging content from artists/${fromIdArg} (${fromDoc.data()?.name}) into artists/${toIdArg} (${toDoc.data()?.name})`);
    console.log(`Mode: ${dryRun ? 'DRY RUN - no writes' : 'APPLY'}`);
    console.log();

    const collections = [
      { path: 'songs', docIdField: 'songId' },
      { path: 'albums', docIdField: 'albumId' },
      { path: 'sponsors', docIdField: 'sponsorId' },
    ];
    let totalTouched = 0;

    for (const col of collections) {
      const snapshot = await db.collection(col.path).get();
      const affected = snapshot.docs.filter((d) => d.data().artistId === fromIdArg);
      if (affected.length === 0) {
        console.log(`  ${col.path}: no documents reference artists/${fromIdArg}`);
        continue;
      }

      const refs: Array<{ docId: string; display: string }> = affected.map((d) => {
        const data = d.data();
        return { docId: d.id, display: String(data[col.docIdField] ?? d.id) };
      });
      refs.forEach((r) => logAction(`${col.path}/${r.docId}`, `artistId ${fromIdArg} -> ${toIdArg} (${r.display})`, dryRun));
      totalTouched += affected.length;

      if (!dryRun) {
        // Chunked writes stay below the Firestore 500-op batch limit.
        for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
          const batch = db.batch();
          affected.slice(i, i + BATCH_LIMIT).forEach((d) => {
            batch.update(d.ref, { artistId: toIdArg });
          });
          await batch.commit();
        }
      }
    }

    if (retireSource && totalTouched > 0) {
      logAction('artists/' + fromIdArg, 'soft-delete (isDeleted=true, deletedAt=now)', dryRun);
      if (!dryRun) {
        await fromDoc.ref.update({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
      }
    } else if (retireSource) {
      console.log('  --retire-source skipped: nothing was merged.');
    }

    console.log();
    console.log(`Merged ${totalTouched} document(s) to artists/${toIdArg}.`);
    if (dryRun) {
      console.log('Dry-run complete - no data was modified. Rerun without --dry-run to apply.');
    } else if (retireSource) {
      console.log(`Source artists/${fromIdArg} soft-deleted; run 'firebase deploy --only firestore:rules' only if rules changed (none here).`);
    }
  } catch (error) {
    console.error('Merge failed:', error);
    process.exit(1);
  }
}

main();

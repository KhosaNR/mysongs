/**
 * Backfills pricing fields introduced by the pay-what-you-want (PWYW) feature:
 * - Songs missing `minimumPriceZAR` get `minimumPriceZAR = priceZAR` so the
 *   payable floor matches today's standard price (only when priced > 0).
 * - Albums missing `priceZAR` get `priceZAR = sum of their non-deleted track
 *   standard prices`.
 * - Albums missing `minimumPriceZAR` get `minimumPriceZAR = sum of their track
 *   minimums` (falling back to each track's standard price), so the album floor
 *   equals buying every track at its minimum.
 *
 * @runbook
 *   npx tsx scripts/backfill-pricing.ts --dry-run   # preview only
 *   npx tsx scripts/backfill-pricing.ts             # apply changes
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function logAction(action: string, detail: string, dryRun: boolean): void {
  console.log(`  ${dryRun ? '[dry-run]' : '[apply]'} ${action}: ${detail}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  try {
    const db = await initializeFirebase();

    console.log(`Backfilling PWYW pricing (${dryRun ? 'DRY RUN' : 'APPLY'})...`);
    console.log();

    let songsTouched = 0;
    let albumsTouched = 0;

    // 1. Songs: default minimum price to the standard price when missing.
    const songsSnapshot = await db.collection('songs').get();
    const songsMissingMin = songsSnapshot.docs.filter((d) => {
      const data = d.data();
      return data.minimumPriceZAR == null && (data.priceZAR ?? 0) > 0;
    });

    console.log(`Songs: ${songsMissingMin.length}/${songsSnapshot.size} missing minimumPriceZAR (priced)`);
    for (const d of songsMissingMin) {
      const price = d.data().priceZAR as number;
      logAction(`songs/${d.id}`, `set minimumPriceZAR=${round2(price)}`, dryRun);
    }
    songsTouched += songsMissingMin.length;

    if (!dryRun && songsMissingMin.length > 0) {
      for (let i = 0; i < songsMissingMin.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        songsMissingMin.slice(i, i + BATCH_LIMIT).forEach((d) => {
          batch.update(d.ref, { minimumPriceZAR: round2(d.data().priceZAR as number) });
        });
        await batch.commit();
      }
    }

    console.log();

    // 2. Albums: derive standard price from tracks, then default the minimum.
    const albumsSnapshot = await db.collection('albums').get();
    const songsByAlbum = new Map<string, Array<{ priceZAR?: number; minimumPriceZAR?: number }>>();

    for (const d of songsSnapshot.docs) {
      const data = d.data();
      if (data.isDeleted === true) continue;
      const albumId = data.albumId as string | undefined;
      if (!albumId) continue;
      const list = songsByAlbum.get(albumId) ?? [];
      list.push({ priceZAR: data.priceZAR, minimumPriceZAR: data.minimumPriceZAR });
      songsByAlbum.set(albumId, list);
    }

    for (const d of albumsSnapshot.docs) {
      const data = d.data();
      const tracks = songsByAlbum.get(d.id) ?? [];
      const pricedTracks = tracks.filter((t) => (t.priceZAR ?? 0) > 0);

      const updates: Record<string, number> = {};

      if (data.priceZAR == null && pricedTracks.length > 0) {
        const standard = round2(pricedTracks.reduce((sum, t) => sum + (t.priceZAR ?? 0), 0));
        updates.priceZAR = standard;
      }

      if (data.minimumPriceZAR == null && data.priceZAR != null && (data.priceZAR as number) > 0) {
        const floor = round2(
          tracks.reduce((sum, t) => sum + ((t.minimumPriceZAR ?? 0) > 0 ? t.minimumPriceZAR! : t.priceZAR ?? 0), 0)
        );
        if (floor > 0 && floor <= (data.priceZAR as number)) {
          updates.minimumPriceZAR = floor;
        }
      }

      const keys = Object.keys(updates);
      if (keys.length === 0) continue;

      albumsTouched += 1;
      logAction(`albums/${d.id}`, keys.map((k) => `${k}=${updates[k]}`).join(', '), dryRun);

      if (!dryRun) {
        await d.ref.update(updates);
      }
    }

    console.log();
    console.log(`Songs fixed: ${songsTouched} · Albums fixed: ${albumsTouched}`);
    if (dryRun) {
      console.log('Dry-run complete - no data was modified. Rerun without --dry-run to apply.');
    } else {
      console.log('Backfill complete. PWYW pricing is now populated for existing content.');
    }
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

main();

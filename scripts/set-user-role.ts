/**
 * Role assignment script for the My Songs platform.
 *
 * Sets Firebase custom claims AND ensures the Firestore user document
 * (`users/{userId}`) and the private auth->user mapping exist. The Firestore
 * user doc is the app's source of truth for role/artistId/artistStatus;
 * custom claims are required for the elevated admin role at the Firestore
 * rules level.
 *
 * Handles both new schemas (opaque userId + `user_auth_lookup`) and legacy
 * accounts whose `users/{uid}` document predates the migration.
 *
 * @runbook npx tsx scripts/set-user-role.ts <uid|email> <role> [artistId]
 * @example
 *   npx tsx scripts/set-user-role.ts abc123 artist leobee_01
 *   npx tsx scripts/set-user-role.ts admin@example.com admin
 *   npx tsx scripts/set-user-role.ts abc123 listener
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { environment } from '../src/environments/environment';
import { resolveServiceAccount, resolveTargetEnv } from './lib/service-account';

type Role = 'admin' | 'artist' | 'listener';

interface RoleClaims {
  role: Role;
  userId: string;
  artistId?: string;
}

function parseArgs(): { identifier: string; role: Role; artistId?: string } {
  const [, , identifierArg, roleArg, artistIdArg] = process.argv;

  if (!identifierArg) {
    console.error('Usage: npx tsx scripts/set-user-role.ts <uid|email> <role> [artistId]');
    console.error('  role: admin | artist | listener');
    console.error('  artistId: required for artist role (e.g., leobee_01)');
    process.exit(1);
  }

  const validRoles: Role[] = ['admin', 'artist', 'listener'];
  if (!roleArg || !validRoles.includes(roleArg as Role)) {
    console.error(`Invalid role "${roleArg}". Must be one of: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  const role = roleArg as Role;

  if (role === 'artist' && !artistIdArg) {
    console.error('Artist role requires an artistId argument (e.g., leobee_01)');
    console.error('Usage: npx tsx scripts/set-user-role.ts <uid|email> artist <artistId>');
    process.exit(1);
  }

  return { identifier: identifierArg, role, artistId: artistIdArg };
}

async function resolveUid(auth: Auth, identifier: string): Promise<string> {
  if (identifier.includes('@')) {
    const userRecord = await auth.getUserByEmail(identifier);
    return userRecord.uid;
  }
  return identifier;
}

async function initializeFirebase() {
  const serviceAccount = await resolveServiceAccount(resolveTargetEnv());
  if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error('Service account not found. Ensure firebaseServiceAccount exists for the target environment or set GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const app = initializeApp({
    credential: cert(serviceAccount as Record<string, unknown>),
  });
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function upsertAuthMapping(db: FirebaseFirestore.Firestore, authUid: string, userId: string): Promise<void> {
  const ref = db.collection('user_auth_lookup').doc(authUid);
  await ref.set({ userId, createdAt: new Date() }, { merge: true });
}

async function main(): Promise<void> {
  const { identifier, role, artistId } = parseArgs();

  try {
    const { auth, db } = await initializeFirebase();
    const uid = await resolveUid(auth, identifier);

    console.log('Setting role...');
    console.log(`  UID: ${uid}`);
    console.log(`  Role: ${role}`);
    if (artistId) {
      console.log(`  ArtistId: ${artistId}`);
    }
    console.log();

    // Resolve the canonical public user document key. The private auth->user
    // mapping is authoritative; legacy accounts fall back to `users/{uid}`;
    // brand-new accounts get a fresh opaque id and mapping.
    const lookupRef = db.collection('user_auth_lookup').doc(uid);
    const lookupDoc = await lookupRef.get();
    const mappedUserId = lookupDoc.exists ? (lookupDoc.get('userId') as string | undefined) : undefined;

    const uidKeyedRef = db.collection('users').doc(uid);
    const uidKeyedDoc = await uidKeyedRef.get();
    const uidKeyedUserId = uidKeyedDoc.exists ? (uidKeyedDoc.get('userId') as string | undefined) : undefined;

    let userId: string;
    let userDocRef = uidKeyedRef;
    let userDoc = uidKeyedDoc;

    if (mappedUserId) {
      userId = mappedUserId;
      userDocRef = db.collection('users').doc(userId);
      userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        // Canonical doc is missing - hydrate it from the legacy `users/{uid}` copy.
        await userDocRef.set({
          userId,
          authUid: uid,
          email: uidKeyedDoc.exists ? (uidKeyedDoc.get('email') ?? null) : null,
          displayName: uidKeyedDoc.exists ? (uidKeyedDoc.get('displayName') ?? null) : null,
          consent: uidKeyedDoc.exists && uidKeyedDoc.get('consent')
            ? (uidKeyedDoc.get('consent') as Record<string, unknown>)
            : { marketingEmail: false, dataProcessing: true, whatsapp: false },
          createdAt: uidKeyedDoc.exists && uidKeyedDoc.get('createdAt')
            ? (uidKeyedDoc.get('createdAt') as FirebaseFirestore.FieldValue)
            : new Date(),
        });
        userDoc = await userDocRef.get();
      }
    } else if (uidKeyedDoc.exists && uidKeyedUserId) {
      // Legacy doc declares a public id - adopt it as canonical.
      userId = uidKeyedUserId;
      userDocRef = db.collection('users').doc(userId);
      userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        await userDocRef.set({ ...(uidKeyedDoc.data() ?? {}), userId, authUid: uid } as Record<string, unknown>);
        userDoc = await userDocRef.get();
      }
    } else if (uidKeyedDoc.exists) {
      // True legacy schema: the `users/{uid}` document is canonical.
      userId = uid;
    } else {
      // Brand-new account with no Firestore documents yet.
      userId = db.collection('_ids').doc().id;
      userDocRef = db.collection('users').doc(userId);
      await userDocRef.set({
        userId,
        authUid: uid,
        email: null,
        displayName: null,
        consent: { marketingEmail: false, dataProcessing: true, whatsapp: false },
        createdAt: new Date(),
      });
      userDoc = await userDocRef.get();
    }

    await upsertAuthMapping(db, uid, userId);

    // Write claims together with the resolved public id so security rules can
    // resolve the user (getUserPublicId) without a cross-document read.
    const claims: RoleClaims = { role, userId };
    if (role === 'artist' && artistId) {
      claims.artistId = artistId;
    }
    await auth.setCustomUserClaims(uid, claims);

    const updateData: Record<string, unknown> = {
      role,
      updatedAt: new Date(),
    };

    if (role === 'artist') {
      updateData.artistId = artistId;
      updateData.artistStatus = userDoc.exists && userDoc.get('artistStatus')
        ? (userDoc.get('artistStatus') as string)
        : 'approved';
    } else {
      updateData.artistId = null;
      updateData.artistStatus = null;
      updateData.rejectionReason = null;
    }

    await userDocRef.update(updateData);

    const user = await auth.getUser(uid);
    console.log('Role set successfully:');
    console.log(`  User: ${user.email || user.displayName || uid}`);
    console.log(`  Claims: ${JSON.stringify(user.customClaims)}`);
    console.log(`  Firestore userId: ${userId}`);
    console.log();
    console.log('The user must sign out and sign back in for the new claims to take effect.');
  } catch (error) {
    console.error('Failed to set role:', error);
    process.exit(1);
  }
}

main();

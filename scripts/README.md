# Seed Scripts

Scripts for populating Firestore with initial data for development and testing.

## migrate-identity-schema.ts

Re-keys legacy Firestore documents from Firebase Auth UIDs to opaque application
IDs, decoupling auth identity from public IDs. Re-keys `users/{uid}` →
`users/{newUserId}`, `artists/{oldId}` → `artists/{newArtistId}`, creates the
private `user_auth_lookup/{authUid}` mapping, and rewrites all content/ledger
references — including the `artistId` field on user documents.

```bash
npx tsx scripts/migrate-identity-schema.ts --dry-run   # preview only
npx tsx scripts/migrate-identity-schema.ts             # apply changes
```

## repair-identity-mappings.ts

Repairs user ↔ artist ↔ auth mappings AFTER the identity-schema migration.
The migration cannot rewrite `users/*.artistId` in the same pass (users are
re-keyed before artists), so those fields can be left stale. This script
rebuilds the linkage from the current DB state:

- `artists/{artistId}.userId` — owner's public user id (canonical)
- `user_auth_lookup/{authUid}` — Firebase Auth UID → public user id
- `users/{userId}.artistId` — rewritten to the current artist doc id

It also re-syncs Firebase custom claims for artist owners and reports stale
legacy `users/{uid}` duplicates (optionally prunes them).

```bash
npx tsx scripts/repair-identity-mappings.ts --dry-run        # preview only
npx tsx scripts/repair-identity-mappings.ts                  # apply fixes
npx tsx scripts/repair-identity-mappings.ts --prune-stale    # also delete legacy dupes
```

Supersedes the deleted `fix-user-artistids.ts`.


## merge-artist-content.ts

Consolidates all content (songs/albums/sponsors) from one artist into another
and optionally retires the source artist. Used to fold the legacy seed artist
(ex-`leobee_01`) into the registered artist workspace after the identity
migration left both in the database. `purchases_ledger` is never touched.

```bash
npx tsx scripts/merge-artist-content.ts <sourceArtistId> <targetArtistId> --dry-run
npx tsx scripts/merge-artist-content.ts <sourceArtistId> <targetArtistId> --retire-source
```


## backfill-song-credits.ts

Flattens the legacy nested `credits` object on song documents into top-level
`writtenBy` / `producedBy` / `mixedMasteredBy` fields, deletes the old `credits`
object, and backfills `producers` (from the produced-by value) plus
`featuredArtists` (from a per-catalog map for the seeded Ku Langhe Mbilu tracks).
Existing top-level values are never overwritten.

```bash
npx tsx scripts/backfill-song-credits.ts --dry-run   # preview only
npx tsx scripts/backfill-song-credits.ts             # apply changes
```


## backfill-isdeleted.ts

Sets `isDeleted: false` on every catalog document (artists/albums/songs) that
predates the soft-delete feature, so public queries can exclude deleted content
server-side with `where('isDeleted', '==', false)`. Firestore filters do NOT
match documents where the field is missing, so this must run before those
queries are enabled.

```bash
npx tsx scripts/backfill-isdeleted.ts --dry-run
npx tsx scripts/backfill-isdeleted.ts
```
## Targeting a Different Project (e.g. QA)

Maintenance scripts use the service account from `environment.ts` by default.
To run them against another Firebase project, point `GOOGLE_APPLICATION_CREDENTIALS`
at that project's service-account JSON file:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/qa-service-account.json npx tsx scripts/set-user-role.ts user@example.com admin
```

## Target the QA Environment (--env qa)

Pass `--env qa` to use the `firebaseServiceAccount` from `environment.qa.ts` directly (no separate service-account file needed):

```bash
npx tsx scripts/set-user-role.ts user@example.com admin --env qa
npx tsx scripts/backfill-isdeleted.ts --dry-run --env qa
```

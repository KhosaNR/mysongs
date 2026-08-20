# Technology Stack

## Production Technology Stack

```text
┌──────────────────────────────────────────────────────────────┐
│                      Angular v22                              │
│     (Zoneless Reactivity, Signal Forms, Vite Engine, SSR)     │
└───────────────────────────┬──────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Cloudflare     │ │    Firebase      │ │     Yoco        │
│   Pages          │ │    (Spark Tier)  │ │   Web SDK       │
│   (Hosting +     │ │                  │ │  (ZAR R5.00     │
│    SSR + CDN)    │ │  • Auth          │ │   Checkout)     │
│   R2             │ │  • Firestore     │ │                 │
│   (Audio +       │ │    (Metadata,    │ └─────────────────┘
│    Album art)    │ │     Users,       │
│   Workers        │ │     Purchases)   │
│   (Serverless    │ └─────────────────┘
│    functions)    │
└─────────────────┘
```

### 1. Web Frontend: Angular v22
- Standardize on **[Zoneless Change Detection]** to optimize CPU cycles and minimize client bundle footprints.
- Use **[Angular v22 Signal Forms](https://angular.dev/guide/forms/signals)** (`form()`, `schema()`, `required()`, `email()`, … from `@angular/forms/signals`) to enforce reactive, type-safe validation. Every required field renders an inline `.form-field__error` message adjacent to the control (see `system-architecture.md` → "Field-Level Form Validation (Platform Standard)").
- Implement **[Server-Side Rendering (SSR)]** to ensure lyric sheets, gig dates, and artist bios are indexable by search engines.

### 2. Hosting & Edge Network: Firebase Hosting + Cloudflare (Free Tier)
- **Firebase Hosting:** Hosts the Angular SSR application output (deployed via `firebase.json` `hosting` — static + SPA rewrites), served over Firebase global CDN.
- **Cloudflare Workers:** Serverless functions for backend logic (webhooks, signed upload/download URLs, rate limiting) with sub-millisecond cold starts; deployed per environment (`my-songs-workers` prod / `my-songs-workers-qa` QA).
- **Cloudflare CDN:** Global edge caching for audio streams served from R2 through the worker (zero egress fees).
- **Cloudflare R2:** Object storage for audio files (128 kbps previews + 320 kbps downloads) and album art/artist images. Zero egress fees — critical for a music streaming platform.

**Free tier limits:**
- Firebase Hosting (Spark): 10 GB static storage, 360 MB/day transfer
- Workers: 100,000 requests/day
- R2: 10 GB storage, zero egress fees

### 3. Identity & Database: Firebase Spark Tier (Reduced Scope)
- **[Firebase Auth]:** Manages secure, authenticated sessions (Email/Password, Google). Custom claims are injected into JWT tokens to differentiate Admins, Artists, and Listeners; sessions without a granted role resolve to the derived **VISITOR** state (browse-only) until registration grants either `listener` or `artist`. *No Cloudflare equivalent exists for consumer auth.*
- **[Cloud Firestore]:** Houses lightweight JSON metadata (artists, songs, users, purchases). Structured collections manage permissions via `artistId` scopes. Payloads are tiny (~5KB per request), keeping Spark tier egress well within limits. Playlists and Collections are separate collections:
  - `playlists` — owner-scoped (listener or artist) song sets; `isPublic: true` opens them to public read (share link + copy) while writes stay owner-only.
  - `collections` — always-public song sets curated by an artist from their own songs; readable by everyone, writable by the owning artist (or admin).
- **Pricing model**: songs carry `priceZAR` (standard) + optional `minimumPriceZAR`; albums carry optional `priceZAR` + `minimumPriceZAR`. Items with missing/≤0 standard price are hidden from purchase. `purchases_ledger.amountZAR` always stores the buyer-chosen amount.

**Free tier limits:**
- Spark: 50K reads/day, 20K writes/day, 1GB egress/day (sufficient for JSON metadata only)

### 4. File System: Cloudflare R2
- Utilized to bypass Firebase's 1 GB daily egress limit — R2 has **zero egress fees**.
- Store public low-quality stream assets (128 kbps MP3s) under public paths.
- Store high-fidelity source files (320 kbps MP3s) within highly secured, non-public namespaces.
- Store album art and artist profile images.
- Cloudflare CDN is placed in front of R2 to cache audio streams at edge locations for South African users.

### 5. Payments: Yoco Web SDK
- South African payment processing optimization.
- Operates on a flat fee structure (2.95% per transaction, R0.00 base fee).
- **Pay-what-you-want amounts**: the checkout `amount` is whatever the buyer chose (standard price by default, or more, never below the item's `minimumPriceZAR`). The webhook converts Yoco cents → ZAR and records the actual charged `amountZAR` in the ledger.
- Direct integration via the Yoco checkout script, allowing credit card, Google Pay, and Apple Pay payment processing.

## Infrastructure Security & Operational Protection

### 1. Webhook Signature Verification & Idempotency Gate
- All transaction webhooks emitted by Yoco must hit a secure **Cloudflare Worker** endpoint.
- The Worker must perform cryptographic signature verification against the webhook header to prevent spoofing.
- **[Idempotency Gate]:** Webhook execution must verify and log the incoming Yoco payment event ID in Firestore. If the event has already been processed, the routine must acknowledge immediately (HTTP 200) without executing duplicate database writes.

### 2. Signed Download Security
- High-quality audio files must be retrieved exclusively using expiring, cryptographically signed URLs generated by **Cloudflare Workers**.
- When a Listener requests a download, a Cloudflare Worker must:
  - Verify authentication status via Firebase Auth token.
  - Query `purchases_ledger` to confirm the user purchased the requested `songId` directly (`purchaseType: 'single'`) **or** as part of a completed album purchase whose `songIds` snapshot contains it.
  - Generate an R2 signed URL with a strict 5-minute expiry window.
  - Return header fields configured with `Cache-Control: private, max-age=300` to prevent duplicate billing calls during double-click operations.

### 3. Transactional Consistency (No Redis, Built-in Outbox Pattern)
- To maintain a zero-cost tier, we omit external queues or Redis engines.
- **[Firestore Triggers]:** When a webhook payment verifies successfully, the Worker performs a single write to a `/purchases_ledger` collection. A background Firestore Trigger initiates automatically on this event to execute downstream tasks (adding the track to user records, incrementing sales telemetry, and staging email receipts). If a downstream step fails, Firebase retries execution to maintain eventual consistency.

### 4. Operational Caching Strategy
- **[Client Caching]:** Leverage Firestore's offline persistence layer to cache user configurations, playlists, and track indices locally.
- **[Edge Caching]:** Pre-rendered SSR pages are cached globally at Cloudflare's edge CDN nodes across South Africa. Audio streams are cached at the edge via Cloudflare CDN in front of R2.

### 5. Search Strategy
- **Client-side fuzzy search:** Fuse.js library (~15KB gzipped) provides typo-tolerant search across artist names, track titles, and lyrics without requiring a paid search service.
- **Firestore keyword indexing:** Tracks store expanded `searchKeywords` arrays for `array-contains` queries on prefixes.
- **Future migration path:** Algolia, Meilisearch, or Typesense for production scaling.

### 6. Defensive Logging & POPIA Compliance
- **[PII Masking]:** Logs must pass through a sanitization pipe. Raw email addresses, phone formats, credit card signatures, and physical addresses must be masked before write execution.
- **[Audit Trails]:** A dedicated, read-only `purchases_ledger` collection must record all transaction reference IDs, purchasing user IDs, timestamp objects, and file access actions for dispute resolution.
- **[Rate Limiting]:** Protect Cloudflare Worker endpoints with sliding-window rate limit checks (maximum 5 download requests per minute per user).

## Storage Requirements

| Asset Type | Format | Size Estimate | Storage (75 tracks) |
|---|---|---|---|
| Low-res preview | 128 kbps MP3, ~4 min | 3.8 MB per track | ~285 MB |
| High-res download | 320 kbps MP3, ~4 min | 9.6 MB per track | ~720 MB |
| Album art | JPEG/WebP, 1200x1200 | ~500 KB per album | ~2.5 MB |
| Artist images | JPEG/WebP | ~1 MB | ~1 MB |
| **Total R2 storage** | | | **~1 GB** |

R2 free tier: 10 GB — well within limits with room for growth.
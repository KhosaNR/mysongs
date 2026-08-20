# System Architecture

## Repository Architecture Blueprint

```text
src/app/
├── app.config.ts          # Configures SSR, zoneless providers, Firebase config, and routing
├── app.component.ts       # Host shell containing the persistent global player component
├── core/                  # Core singletons and infrastructure integrations
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── db.service.ts
│   │   ├── payment.service.ts
│   │   ├── audio-player.service.ts
│   │   ├── playlist.service.ts      # Owner-scoped playlist CRUD (private + optional public)
│   │   ├── collection.service.ts    # Artist-curated public collection CRUD
│   │   └── network-status.service.ts
│   ├── guards/
│   │   └── auth.guard.ts
│   └── interceptors/
│       ├── error.interceptor.ts
│       └── loading.interceptor.ts
├── shared/                # Global presentational components & structured models
│   ├── components/
│   │   ├── loading-spinner/
│   │   ├── track-row/
│   │   ├── modal-dialog/
│   │   └── audio-player/       # Global persistent player with tabs
│   └── models/
│       ├── artist.interface.ts
│       ├── album.interface.ts
│       ├── song.interface.ts
│       ├── purchase.interface.ts
│       └── user.interface.ts
└── features/              # Feature modules (Lazy-loaded views)
    ├── home/              # Artist spotlight and promotional dashboard
    ├── search/            # Dynamic global multi-index query terminal
    ├── lyrics/            # Lyric scroll sheet with interactive popups
    ├── playlists/         # Private playlists (per-playlist sidebar rows; optional public share + copy)
    ├── collections/       # Public artist-curated song sets (create/edit/copy to playlists)
    └── admin/             # Restricted administrative settings interface
```

## Production Coding Guidelines

### 1. Asynchronous Execution Safety
* All database transactions, authentication requests, and external gateway executions must wrap inside explicit try-catch blocks.
* Catch statements must log sanitized diagnostic metrics on the server while surfacing consumer-friendly error banners to the user interface.

### 2. Angular v22 Signal Implementations
* Leverage modern **Angular Signals** (`input()`, `output()`, `computed()`, `model()`) for internal component communications.
* Enforce `ChangeDetectionStrategy.OnPush` across all UI elements.
* Avoid direct variable mutation outside of Signal updates.

### 3. Field-Level Form Validation (Platform Standard)
* Every form on the platform **MUST** use the **Angular v22 Signal Forms API** (`form()`, `schema()`, `required()`, `email()`, `minLength()`, `min()`, `max()`, `pattern()`, `disabled()`, `readonly()`, `validate()`) — imported from `@angular/forms/signals`.
* Each form is built from a `WritableSignal` model via `form(model, schemaFn)`; the signal model remains the single source of truth for save logic.
* Templates use `<form [formRoot]="form" (submit)="onSubmit()">` and `<input [formField]="form.field" />`. Never set `name`, `required`, `min`, `max`, `minlength`, `maxlength`, `pattern`, `readonly`, or `disabled` attributes on `[formField]` elements — the directive manages these from the schema (NG8022 otherwise).
* Every validated control renders its errors inline with `<app-field-errors [field]="form.field" />` (shared `FieldErrorsComponent`), which emits `.form-field__error` lines with `aria-live="polite"` once the field is touched/invalid.
* Invalid controls automatically receive the `.input-error` class (red border + focus ring) via `provideSignalFormsConfig` in `app.config.ts` — no per-input class bindings.
* Submit handlers **MUST** call `form().markAsTouched()` first and bail out with `if (form().invalid()) return;` so required/empty fields reveal their inline errors on submit attempt.
* Submit buttons are disabled **only during active transactions** (loading/saving/uploading signals) — never because the form is invalid (silent disabled buttons hide validation feedback).
* Conditional validation (e.g. `albumId` required when `songType === 'album'`, audio file required in create mode) uses `validate(path, ctx => …)` with `ctx.valueOf(otherPath)` or `required(path, { when: … })`.
* Cross-field checks (e.g. password match) use `validate(path, ctx => …)` returning `{ kind, message }` **without** a `fieldTree` property (the error belongs to the field the validator is attached to).
* Reopening modal forms (`openCreateForm`/`openEditForm`/`closeForm`) calls `form().reset()` to clear touched/dirty/error state from the previous session.

### 4. Telemetry Logging Standards
* Implement structured TS Doc XML comment structures on all core architecture files to document parameters, outcomes, and logical boundaries.

## Cloudflare Workers Architecture

### Worker Endpoints

```text
workers/
├── src/
│   ├── index.ts                 # Router entry point
│   ├── webhooks/
│   │   └── yoco.ts              # Yoco payment webhook handler
│   ├── downloads/
│   │   └── signed-url.ts        # R2 signed URL generator
│   ├── middleware/
│   │   ├── auth.ts              # Firebase Auth token verification
│   │   ├── rate-limiter.ts      # Sliding-window rate limiting
│   │   └── cors.ts              # CORS headers
│   └── utils/
│       ├── firestore.ts         # Firestore client helpers
│       ├── logger.ts            # PII-masked logging
│       └── validation.ts        # Server-side data validation
```

### Worker Request Flow

1. **Yoco Webhook:** Yoco → Cloudflare Worker → Signature Verify → Idempotency Check → Firestore Write → HTTP 200
2. **Signed Download:** Client → Cloudflare Worker → Auth Verify → Firestore Purchase Check → R2 Signed URL → Response
3. **Rate Limiting:** All Worker endpoints enforce sliding-window rate limits before processing

## Icon Policy

- **Use Angular Material Icons exclusively** for all icons throughout the application
- Install via: `@angular/material` package
- Usage in templates: `<span class="material-icons">icon_name</span>`
- **Prohibited**: Emoji icons (📊, 🎤, 🎵, 📈, 💰, 🤝, etc.)
- **Prohibited**: Custom SVG icons unless absolutely necessary for branding
- **Prohibited**: Third-party icon libraries other than Angular Material
- Reference: https://fonts.google.com/icons for available Material Icons
- Common icon names: dashboard, people, music_note, analytics, attach_money, handshake, explore, play_arrow, download, group

## Production Firestore Collection Layout

### 'artists' Collection
```json
{
  "artistId": "leobee_01",
  "name": "Leo Bee",
  "bio": "Production biography details...",
  "socials": {
    "facebook": "https://facebook.com/leobeemusic"
  },
  "sponsors": [
    { "name": "Sponsor Name", "logoUrl": "https://..." }
  ]
}
```

### 'songs' Collection
```json
{
  "songId": "track_101",
  "artistId": "leobee_01",
  "title": "Your Love feat Hopey B",
  "albumId": "album_01",
  "youtubeVideoId": "dQw4w9WgXcQ",
  "streamUrl": "https://pub-r2.dev/stream/track_101.mp3",
  "securePath": "secure_audio/track_101_320.mp3",
  "priceZAR": 5.00,
  "minimumPriceZAR": 3.00,
  "isTopSong": true,
  "duration": 245,
  "genre": "Hip-Hop/Rap",
  "lyrics": "Your love is all I need...",
  "annotations": [
    {
      "start": 12,
      "end": 35,
      "text": "Verse annotation background story..."
    }
  ]
}
```

### 'albums' Collection
```json
{
  "albumId": "album_01",
  "artistId": "leobee_01",
  "title": "Ku Langhe Mbilu",
  "genre": "Hip-Hop/Rap",
  "releaseDate": "2020-01-01T00:00:00Z",
  "priceZAR": 30.00,
  "minimumPriceZAR": 15.00,
  "artworkUrl": "https://pub-r2.dev/art/album_01.jpg",
  "themeColors": {
    "primary": "#C5FCFB"
  }
}
```

### 'users' Collection
```json
{
  "userId": "firebase_uid_12345",
  "email": "fan@domain.co.za",
  "displayName": "Sipho Ngwenya",
  "role": "listener",
  "themePreferences": {
    "darkMode": true,
    "artistId": "leobee_01"
  },
  "consent": {
    "marketingEmail": true,
    "dataProcessing": true,
    "whatsapp": false
  },
  "createdAt": "2026-01-15T08:00:00Z"
}
```

> **Role note:** New accounts are provisioned as either `listener` or `artist`; `visitor` is a *derived* session state for authenticated users with no granted role (no elevated custom-claim role and no role on the user document) and is **never persisted** as a new-account role.

### 'purchases_ledger' Collection (Read-Only)
```json
{
  "purchaseId": "yoco_event_998811",
  "userId": "firebase_uid_12345",
  "artistId": "leobee_01",
  "purchaseType": "single",
  "songId": "track_101",
  "amountZAR": 5.00,
  "timestamp": "2026-07-02T11:00:00Z",
  "gatewayReference": "ch_99211AAsd",
  "status": "completed"
}
```

```json
{
  "purchaseId": "yoco_event_998812",
  "userId": "firebase_uid_12345",
  "artistId": "leobee_01",
  "purchaseType": "album",
  "albumId": "album_01",
  "songIds": ["track_101", "track_102", "track_103"],
  "amountZAR": 15.00,
  "timestamp": "2026-07-02T12:00:00Z",
  "gatewayReference": "ch_99211BBsd",
  "status": "completed"
}
```

## Global Player Architecture

### Player Component (P003FT002 - Planned)
The global audio player lives in the app shell (`app.component.ts`) as a persistent bottom bar.

**Layout:**
- **Collapsed state**: Mini-bar at bottom showing album artwork, song title, artist name, and play/pause button. User can browse the site normally.
- **Expanded state**: Slides up to reveal 3 tabs while keeping persistent playback controls at the bottom.

**Tab 1: Now Playing**
- Album artwork (large)
- Song title, artist name
- Download / Purchase button (if not purchased)
- Share button (WhatsApp deep link)
- YouTube video embed as **manual toggle** — hidden by default. If `youtubeVideoId` exists on the track, a toggle button appears. Clicking it opens an iframe embed using `youtube-nocookie.com`. Video does not auto-play to avoid audio conflicts with the HTML audio element.
- Audio-only is the default experience.

**Tab 2: Playlist (Queue)**
- Displays the current playback queue from `AudioPlayerService.queue`
- Currently playing track highlighted with an indicator
- Tap any track to jump to it
- Clear queue button

**Tab 3: Lyrics**
- Shows `Song.lyrics` for the currently playing track
- Scrollable text view
- Future: highlighted annotations, auto-scroll with playback

### AudioPlayerService Track Model
Enriched `Track` interface:
```typescript
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly artistId: string;
  readonly albumId?: string;
  readonly streamUrl: string;
  readonly artworkUrl?: string;
  readonly duration?: number;
  readonly youtubeVideoId?: string;
  readonly lyrics?: string;
  readonly priceZAR?: number;
  readonly minimumPriceZAR?: number;
}
```

## Purchase Model Design

**Streaming is free for all** — no authentication required. Purchasing unlocks 320kbps download and offline playback only.

- **`purchases_ledger`** is the authoritative source of truth for all transactions.
- **No purchase state arrays on the User document** — download authorization is verified by querying the ledger directly.
- **Pay-what-you-want (PWYW) pricing on songs and albums**:
  - Each purchasable item carries a **standard price** (`priceZAR`) and an optional **minimum price** (`minimumPriceZAR`).
  - The checkout dialog pre-fills the standard price (the default) and lets the buyer pay any amount **≥ the minimum**; when `minimumPriceZAR` is unset/≤0 the floor equals the standard price.
  - The ledger records the **actual charged amount** (`amountZAR` from the Yoco payload); no separate donation flag is stored.
  - Both **artists and admins** may set/edit the standard and minimum price on their content (and admins on any content). Form validation enforces `minimumPriceZAR ≤ priceZAR`.
- **Polymorphic purchases**: `purchaseType: 'single' | 'album'`
  - Single purchase: `songId` field references the purchased track
  - Album purchase: `albumId` + `songIds` snapshot of all tracks in the album at time of purchase (written by the webhook, which queries `songs` by `albumId` with `isDeleted == false`)
- **Album ownership check**: `PaymentService.checkAlbumPurchaseStatus()` reads the user's own `purchases_ledger` rows (`where userId == <self>`) and filters for a completed album purchase — no composite index required.
- **Download authorization**: The signed URL worker queries `purchases_ledger` to verify a user has purchased either the specific song or an album containing it.
# Product Overview

## Problem Statement
Traditional music streaming ecosystems minimize artist payouts and sever direct communication channels with fans. DSPs pay fractions of a cent per stream, prioritize major-label artists in algorithms, and provide artists with zero access to listener data. South African independent artists face additional challenges: physical CD distribution is declining, streaming is still maturing in the market, and there are no affordable direct-to-fan platforms tailored to local needs.

**My Songs** replaces these layers with a direct fan relationship platform — a digital marketing hub where fans can discover free content (previews, lyrics, videos, blog), engage with the artist, and optionally purchase high-quality downloads at a fair price.

## Core Philosophy: Marketing First, Revenue to Cover Costs

This platform is not designed to replace DSP income. It is designed to:

1. **Own the fan relationship** — Capture emails and WhatsApp contacts so the artist can communicate directly with fans about new releases, shows, and merch
2. **Differentiate the artist brand** — Interactive lyrics, behind-the-scenes content, and a polished custom website build trust and professionalism that DSPs cannot provide
3. **Drive discovery through SEO and social sharing** — Each track page is SEO-optimized and one-tap shareable on WhatsApp, generating organic word-of-mouth
4. **Generate revenue to cover hosting costs** — 320kbps MP3 downloads at R5.00 per track provide a small income stream sufficient to maintain the zero-cost infrastructure

## Role-Based Access Control (RBAC)

### 0. Visitor (No Authorization)
* A person who is **not logged in**, or an authenticated session that has **not been granted a role** (e.g., a social sign-in that has not completed registration).
* Browse-only access: Explore, Search, and low-fidelity (128 kbps) preview streaming.
* No playlists, purchases, downloads, dashboard, or account features until a role is granted.
* Visitors are never provisioned as `users` documents; registration grants either the `listener` or `artist` role.

### 1. System Administrator
* Global configuration rights over the entire platform.
* Capability to provision and manage Artist profiles.
* Full read and write authority across all Firestore collections and Cloudflare R2 namespaces.
* Access to global security telemetry, performance metrics, and audit trails.

### 2. Artist
* Context-locked administrative rights tied explicitly to their assigned artistId.
* Authority to upload, modify, or remove their own albums, tracks, tour events, and video entries.
* **Set pricing on their own catalog** — both the **standard price** and the optional **minimum price** for songs and albums (pay-what-you-want); admins can override either value on any artist's content.
* Ability to author, edit, and delete Genius-style lyric annotations for their catalog.
* **Curate public Collections** — reusable, always-public song sets drawn exclusively from the artist's own catalog, shown on their public artist page alongside albums and open to fans to view, stream, and copy into their own playlists.
* **Maintain personal playlists** — artists keep the same private (optionally public) playlist tools as listeners, including per-playlist sidebar rows and copying others' public playlists/collections.
* Access to dedicated dashboard reporting streaming counts, visitor analytics, direct sales metrics, and fan demographics.
* Zero visibility or edit capabilities on data belonging to other artists.

### 3. Listener (Authenticated Fan)
* Standard listener account requiring registration via Email/Password or secure Social Identity Providers. The `listener` role is **explicitly granted** at registration — an authenticated user who is neither an artist nor an admin defaults to **Visitor**, not Listener, until a role is granted.
* Unmetered streaming access to all free public preview tracks (128 kbps).
* Search engine access spanning artists, track titles, album listings, annotated lyrics, and video contexts.
* Right to purchase high-quality 320 kbps MP3 files (single tracks or whole albums) via card, Apple Pay, or Google Pay at the **standard price or more** (pay-what-you-want, never below the artist/admin-set minimum).
* Direct access to a persistent, unmetered download interface for all successfully purchased assets.
* Full control to create, modify, or delete custom personal playlists; may optionally publish a playlist to a public share link that anyone can open, stream, and copy into their own playlists.
* Copy public playlists and artist collections into their own playlists (snapshot of the songs at copy time).

## Core Product Workflows

### 1. Global Navigation & Player Persistence
* Audio streaming must occur via a unified global media player container.
* Page navigation events (e.g., transitions between the home screen, lyric sheets, or tour calendars) must never interrupt, pause, or stutter active playback.

### 2. High-Quality Audio Acquisition
* Unauthenticated visitors can stream low-fidelity (128 kbps) previews.
* Clicking the download option or checking out a track/album requires a Listener account.
* Successful processing of a payment at the **standard price or a higher pay-what-you-want amount** (never below the configured minimum) unlocks the download controller — per track, or all tracks when the whole album was purchased. This state change must register immediately in the user's view, substituting the purchase trigger with an unmetered, secure download link.

### 3. Integrated Global Search
* A singular, high-performance global search console must parse and categorize index structures across:
  - Artist names and bios
  - Song and Album titles
  - Text lyrics
  - Video titles and categories

### 4. POPIA Consent & Right to be Forgotten
* Registration forms must contain clear, un-pre-ticked opt-in checkboxes referencing the platform's Privacy Policy.
* Email/WhatsApp capture widgets must also display clear opt-in consent with reference to the Privacy Policy.
* The Listener dashboard must feature an accessible "Delete My Account" option. This action must trigger a cascading purge of the user's account records, playlist references, and profile documents in compliance with POPIA.

### 5. Fan Relationship Building (Marketing Focus)
* Email/WhatsApp capture widgets must be present on every page (home, track, lyrics, blog, tour) with POPIA-compliant opt-in.
* Pre-release countdown pages must include email capture to notify fans when a new track drops.
* One-tap WhatsApp sharing must be available on every track page with a pre-filled message containing the track link and artist name.
* "Listen on DSPs" links redirect visitors to Spotify, Apple Music, and YouTube Music — converting website traffic into DSP followers.

### 6. Content Marketing Pipeline
* Track pages serve as SEO-optimized landing pages with lyrics, annotations, preview audio, and social sharing.
* Artist blog / news feed provides fresh content for Google rankings and fan engagement.
* Embedded video content (YouTube music videos, behind-the-scenes footage) keeps visitors on the site longer.
* Tour date calendar with Google Maps integration converts online fans into live event attendees.
# Project Brief: My Songs

## Project Identity & Scope
* **Project Name:** My Songs
* **Production Domains:** leobee.com or leobee.co.za (subject to registrar availability)
* **Core Purpose:** An enterprise-grade, direct-to-fan music platform built to enable South African music artists to stream previews, showcase interactive lyrics, and sell high-quality digital downloads directly to fans under a zero-cost infrastructure model.
* **Target Audience:** Dedicated fans, independent music listeners, and local South African artists.

## Scale & Monetization Architecture
* **Scale Capability:** Launching initially for a single artist (Leo Bee), the system must utilize a strict tenant-isolation data model where all entities route through an artistId parameter. This architecture must scale up to 10 independent artists without requiring database schema modifications.
* **Microtransaction Profitability:** Tracks will be sold individually for exactly R5.00 (ZAR). To maintain viability at this price point, the payment channel must avoid flat transaction fee structures.

## Compliance & Legal Constraints
* **POPIA Compliance:** The platform operates in South Africa and must strictly comply with the Protection of Personal Information Act (POPIA). This mandates explicit user consent gates, data minimization, the "Right to be Forgotten" (account self-deletion), and zero exposure of personally identifiable information (PII) in log traces.
* **Download Asset Isolation:** High-fidelity audio files (320 kbps MP3s) must never be directly addressable via public web paths. Downloads must be secured behind short-lived, expiring access tokens.
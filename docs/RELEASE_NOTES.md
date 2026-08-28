# Combined V1 + V2 release notes

## Professional product foundation — August 27, 2026

- Added a resumable five-step onboarding flow for weather, calendar, optional reference photos, closet setup, and readiness review.
- Added credential-free Open-Meteo and manual weather, local privacy-minimized ICS import, and explicit skip/retry paths.
- Added versioned provider contracts and safe demo/disabled adapters across the external integration boundary.
- Added labeled starter wardrobes, an empty-closet path, and tests proving sample inventory is never treated as owned.
- Added a real Three.js asset viewer with front/side/back/reset controls, a generic local fixture, and prominent fit/body-simulation limitations.
- Added owner-scoped onboarding and 3D schema, private Storage policy, operations/privacy documentation, CI, Dependabot, and open-source community files.
- Updated the React, Vinext, Vite, and Cloudflare toolchain to remove all known production dependency advisories.

The public deployment remains a deterministic, non-persistent demonstration. Authenticated Supabase, Google OAuth, live AI try-on, and production 3D generation remain independently gated and disabled by default.

## Added

- Invite-only Supabase magic-link auth and request-scoped cookie PKCE clients.
- Additive `0003_combined_roadmap.sql` with wardrobe metadata, recommendation versioning, immutable wear snapshots, shopping analyses, OAuth states, deletion requests, private events, grants, RLS, and private bucket policies.
- Additive `0004_demo_hardening.sql` with idempotent wear, feedback, and shopping-purchase safeguards. Existing duplicate feedback is deterministically reduced to the newest row before uniqueness is enforced.
- Server-authoritative bootstrap/profile/wardrobe/history/photo flows with optimistic rollback.
- Deterministic owned-closet recommendations, feedback-informed rotation, missing-category guidance, and rolling Week plans.
- Exact-ID Try On jobs with ownership checks, rate limiting, idempotency, and honest outfit boards while live generation is off.
- Screenshot-only Buy/Save/Skip guidance and conversion of a purchased candidate into an owned garment.
- Calendar normalization and AES-GCM refresh-token encryption.
- Storage-first deletion/retry and 24-hour cleanup for unsaved private media.
- Dry-run-first D1/R2 migration tooling and one-time localStorage import hashing.

## Changed

- Add one item and bulk scanning are separate, direct actions.
- History rebuilds the exact saved outfit when no try-on result exists.
- Feedback is reduced to Style and Temperature selections.
- Personal seeded photos and generated try-on imagery were removed from the repository. Generic starter garments remain preview-only.
- The OpenAI provider cannot activate unless `LIVE_TRY_ON_ENABLED=true`.
- Thursday’s exact-piece story now has a generic fictional reference, local deterministic preview, reload-persistent demo History/feedback, keyboard-safe sheets, failure rollback, and explicit pending deletion states.
- Demo garment media ships as optimized WebP assets; the combined garment payload is under 1 MB instead of roughly 30 MB of source PNGs.
- Today’s Try On now opens the exact result in one click. The Dressing Room starts on the selected outfit and exposes an immediate 360° action instead of requiring day setup first.
- Exact previews now include an accessible full-spin card with autoplay, drag/touch rotation, a 0–360 slider, pause, and front reset. The reverse is a verified exact-piece list, not an invented rear garment view.
- Repeat preview creation after changing a piece no longer silently stops when the previous job status is `complete`.

## Deployment state

The code is designed to deploy with the combined bundle disabled. Production activation requires public Supabase configuration, application of migrations `0001`–`0005`, a two-user RLS/Storage rehearsal, migration sign-off, and a final production smoke test. Live AI try-on and production 3D generation stay off. The public Sites host remains a non-persistent preview; widening access does not activate the authenticated bundle.

The protected retention endpoint is implemented, but the hosting platform does not supply a scheduler in this repository. An external scheduler using `CRON_SECRET` must be configured and smoke-tested before the authenticated bundle is activated.

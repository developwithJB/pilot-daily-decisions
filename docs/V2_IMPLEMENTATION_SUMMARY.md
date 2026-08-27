# pilot V2 Implementation Summary (historical)

This document records the earlier V2 presentation build. It is superseded by [Combined launch architecture](COMBINED_LAUNCH.md) and [Combined release notes](RELEASE_NOTES.md); descriptions of bundled personal presentation media below are no longer current.

## What changed

- Preserved the V1 warm editorial design, weather, Calendar fallback, Week, Closet, wear history, laundry state, recommendations, and feedback.
- Added a five-destination responsive navigation with the Dressing Room as the central action.
- Replaced remote/hotlinked imagery with 22 stable local garment assets and reusable dimensional outfit compositions.
- Upgraded Today, Week, Closet, outfit details, and History; History now separates Worn and Tried On.
- Added `/try-on` with Your Day, Your Look, Your Photo, Review, Mirror, and See It There states.
- Added a private `/settings/model` setup with consent, technical photo guidance, default selection, individual deletion, and delete-all controls.
- Added clearly labeled seeded Mirror and restaurant-scene presentation results using the supplied default reference.
- Added mock/live try-on provider boundaries, server-owned prompts, private-location normalization, deterministic request hashing, resumable job states, redacted failures, and a background-removal provider boundary.

## Files added

- Route entry points under `app/week`, `app/try-on`, `app/closet`, `app/history`, and `app/settings/model`
- `app/api/try-on/route.ts`
- `lib/try-on.ts`
- `lib/providers/try-on-provider.ts`
- `lib/providers/background-removal-provider.ts`
- `supabase/migrations/0002_v2_dressing_room.sql`
- `public/assets/garments/*`
- `public/assets/private-demo/*`
- `tests/try-on.test.mjs`
- V2 plan, privacy, image-pipeline, and summary documents

## Files modified

- `app/SydneyApp.tsx`
- `app/globals.css`
- `lib/demo-data.ts`
- `.env.example`
- `README.md`
- `package.json`
- `tests/rendered-html.test.mjs`

## Database migration

`0002_v2_dressing_room.sql` adds person profiles, private reference photos, garment assets, outfit layouts, try-on sessions/jobs/results, scene presets, generation feedback, indexes, updated-at triggers, private Storage buckets, and user-ownership RLS.

## Environment variables

- Demo: `NEXT_PUBLIC_DEMO_MODE`, `TRY_ON_PROVIDER`, `BACKGROUND_REMOVAL_PROVIDER`
- Live images: `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`
- Optional removal service: `REMBG_SERVICE_URL`
- Existing Supabase, recommendation, weather, and Google Calendar variables remain supported.

## Running demo mode

Copy `.env.example` to `.env.local`, retain the three mock/demo defaults, install dependencies, and run `npm run dev`.

## Enabling live image generation

Set `NEXT_PUBLIC_DEMO_MODE=false`, `TRY_ON_PROVIDER=openai`, and add a server-only `OPENAI_API_KEY`. The server calls the image-editing endpoint with the configured image model and quality. Production must store returned bytes in the private result bucket and return a signed URL rather than persisting a browser data URL.

## Adding and deleting Sydney’s photos

Use `/settings/model` after consent. Production uploads strip EXIF, write to the authenticated user folder in the private reference bucket, create a thumbnail and technical assessment, and return signed URLs. Delete removes originals, thumbnails, rows, derived results, and access. The presentation bundle contains only intentionally supplied, downsampled, EXIF-stripped references and is deployed privately.

## Known limitations

- The deployed presentation uses deterministic seeded results; live provider output persistence requires configured Supabase and OpenAI credentials.
- The supplied default reference was selected for technical utility, but its room background is intentionally preserved in Mirror mode.
- The local generated garment set is twelve pieces for presentation clarity rather than a full production wardrobe.
- Google OAuth and Supabase authentication remain optional architecture paths and are not required for the private demo.
- Provider-side partial-image streaming is not enabled.

## Deferred V3 ideas

- Live signed-result persistence and resumable subscriptions.
- More personalized garment asset correction tools and drag-to-adjust layout admin.
- Larger My Closet virtualization, thumbnail pipeline, and scene-preset learning.
- Specialized commercial virtual try-on provider behind the existing interface.

## Image asset generation

The built-in image-generation tool produced the project-bound garment photography using one prompt per item: isolated premium fashion catalog photography, exact specified garment/color, soft directional studio lighting, no person, model, logo, text, or watermark. A second background-extraction pass requested genuine alpha while preserving garment details. Final files were copied into `public/assets/garments` and their light checkerboard pixels were converted to true alpha for browser compositing.

The same built-in tool created the private Mirror result from the default user-supplied reference plus the four selected garments using an identity-preserving, clothing-only edit prompt. The scene result used that approved Mirror image and changed only the environment to a warm contemporary restaurant.

## Validation

- `npm run lint` — passed
- `npm run build` — passed; all six pages and five APIs emitted
- `npm test` — 14 passed, 0 failed
- Browser QA — passed at 390×844 and 1440×900 for Today, Week, Dressing Room, Mirror, Closet, History, and setup; no horizontal overflow or browser errors

## August 2026 clarity QA

- Compressed the mobile Today context so the top-ranked outfit and a clear **Try it on** CTA appear in the first viewport.
- Split the direct preview route from **Customize**: previewing now starts at photo selection, while garment taps open the piece editor.
- Reworded Week, Closet, History, and setup actions around their immediate outcome, including shopping-photo scanning and an early save-and-return action.
- Added accessible names to History feedback controls and regression coverage for the new task-specific CTAs.

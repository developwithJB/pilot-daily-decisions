# Pilot

**A wardrobe decision assistant that answers “What should I wear?” using the clothes you already own.**

- **Deployed ChatGPT Site:** [sydney-style-brain.developwithjb.chatgpt.site](https://sydney-style-brain.developwithjb.chatgpt.site)
- **Public source:** [github.com/developwithJB/pilot-daily-decisions](https://github.com/developwithJB/pilot-daily-decisions)

> **Deployment access:** The hosted ChatGPT Site is public and runs the deterministic sample experience. It does not require setup or external credentials. The authenticated production bundle and live AI try-on remain disabled.

> **Current release:** The public demo includes the five-step guided setup, credential-free Open-Meteo and manual weather, privacy-minimized calendar fallbacks, labeled starter wardrobes, and the disclosed interactive 3D fixture. Production photo, OAuth, AI image, and 3D providers remain off until an operator completes the documented privacy and isolation gates.

Licensed under the [MIT License](LICENSE). Contributions are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md) and report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## What Pilot does

Pilot combines four kinds of context:

- the weather and the user’s plans;
- garments that are owned, available, and appropriate;
- recent wear history and style/temperature feedback; and
- shopping candidates supplied as screenshots.

It turns that context into a small set of useful decisions:

- **Today:** three ranked outfit options with one clear recommendation;
- **Week:** a rolling seven-day outfit plan;
- **Try On:** an exact-piece outfit board with an honest, interactive 360° presentation;
- **Closet:** individual garment entry, bulk scanning, laundry state, and removal;
- **History:** saved outfit snapshots and lightweight feedback; and
- **Shopping:** Buy, Save, or Skip guidance based on what the closet actually needs.

Pilot is not a generic fashion feed. The production design only recommends garments the user owns and can wear, and it never presents a flat outfit board as a photorealistic body simulation.

## Why it exists

Getting dressed is a repeated decision spread across weather, calendar context, laundry, outfit repetition, personal taste, and missing wardrobe categories. Most wardrobe apps store clothes or inspire purchases; they do not make the daily decision.

Pilot is designed to:

- reduce morning decision fatigue;
- help people get more value from clothes they already own;
- prevent unnecessary or duplicative purchases;
- learn from simple feedback without turning dressing into data entry; and
- make recommendation and try-on limitations explicit rather than overstating AI output.

## Try the deployed Site

Open [the deployed ChatGPT Site](https://sydney-style-brain.developwithjb.chatgpt.site). No local setup is required.

The recommended walkthrough is:

1. Start on **Today** and compare the three proposed outfits.
2. Open **Try On** from the selected look.
3. Swap an exact garment, then use the draggable 360° board to verify the selected pieces.
4. Open **Week** to see how outfits rotate across upcoming days.
5. Review **Closet** and **History** to see availability, saved wear snapshots, and feedback.
6. Use the shopping entry point to test Buy, Save, or Skip guidance.

The current hosted presentation uses deterministic sample data. Live AI try-on is disabled.

New installations can also open `/onboarding` for a five-step setup: weather, calendar, optional private reference photos, closet choice, and readiness review. Every stage can be completed without paid credentials or skipped safely.

## Run it locally

### Requirements

- Node.js 22.13 or newer
- npm

### Start the credential-free preview

```bash
git clone https://github.com/developwithJB/pilot-daily-decisions.git
cd pilot-daily-decisions
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The checked-in defaults run the safe deterministic preview:

```env
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED=false
TRY_ON_PROVIDER=mock
LIVE_TRY_ON_ENABLED=false
```

This mode uses bundled generic garments and browser/session state. It does not require Supabase, Google Calendar, or an OpenAI API key, and it does not write sample garments into a production closet.

## How the application works

1. **Context is normalized.** Weather, calendar signals, closet availability, wear history, and feedback are converted into a small decision context.
2. **Eligibility is enforced first.** Inactive, unavailable, unsuitable, or unowned garments are excluded before ranking.
3. **Deterministic rules rank outfits.** The engine balances weather, formality, occasion, rotation, and prior feedback.
4. **The server remains authoritative.** Authenticated production flows resolve user identity, owned garment IDs, storage paths, and recommendation state server-side.
5. **Outputs preserve provenance.** History stores immutable garment snapshots, and the exact-piece preview verifies the selected list instead of inventing unavailable views.
6. **Providers stay replaceable.** Versioned weather, calendar, image, extraction, try-on, avatar, and fitting contracts keep vendor payloads and credentials behind server boundaries.

The primary interface lives in `app/SydneyApp.tsx`; recommendation rules are in `lib/recommendation.ts` and `lib/outfit-engine.ts`; authenticated domain logic is in `lib/pilot-server.ts`.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Today’s owned-closet decision and shopping entry point |
| `/week` | Rolling seven-day outfit plan |
| `/try-on` | Exact outfit builder and interactive verification board |
| `/closet` | Garment entry, bulk scan, laundry, and removal |
| `/history` | Saved wear snapshots and feedback |
| `/settings/model` | Private reference-photo controls |
| `/onboarding` | Resumable five-stage guided setup |
| `/settings/connections` | Revisit weather, calendar, photo, and closet setup |
| `/avatar` | Three.js GLTF/GLB/VRM viewer with a generic local fixture and explicit limitations |

## Provider matrix

| Capability | Credential-free default | Optional production provider | Required fallback |
| --- | --- | --- | --- |
| Weather | Open-Meteo or manual entry | Open-Meteo server adapter | Manual temperature/rain |
| Calendar | Local ICS normalization or manual plan | Google OAuth, read only | Skip or manual plan |
| Closet extraction | Deterministic demo scanner/correction | Server-side vision adapter | Manual correction/entry |
| Background removal | Original cutout/mock | rembg HTTP adapter | Original private image |
| Image try-on | Exact composition board | OpenAI image adapter | Exact composition |
| 3D avatar | Generic local Three.js fixture | `Avatar3DProvider` adapter | Honest disabled state |

Provider and flag guidance is in [Provider development](docs/PROVIDER_DEVELOPMENT.md). Live provider credentials are server-only and provider flags never replace authorization.

## Production mode

The authenticated roadmap bundle is intentionally off by default. Production mode adds invite-only Supabase authentication, Postgres persistence, private Storage, calendar integration, and server-authoritative APIs.

Before enabling `NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED=true`:

1. Configure the required values described in `.env.example`.
2. Apply Supabase migrations `0001` through `0005_professional_product_foundation.sql`.
3. Run the two-user RLS and private Storage isolation rehearsal.
4. Configure and smoke-test the external scheduler for the protected retention endpoint.
5. Complete a final production smoke test.

Live image generation is a separate gate. It requires `LIVE_TRY_ON_ENABLED=true`, a configured provider, server-only credentials, private result storage, and explicit privacy review.

See [Combined launch architecture](docs/COMBINED_LAUNCH.md) and [Privacy notes](docs/V2_PRIVACY_NOTES.md) before configuring production services.

Production 3D generation is intentionally disabled. The included viewer and local fixture test interaction only; they do not represent a user’s body. Enabling a live adapter requires the isolation, retention, deletion, provenance, and disclosure gates in [Professional product foundation](docs/PROFESSIONALIZATION_PLAN.md).

## Security and privacy model

- Cookie-based PKCE clients are request-scoped through `@supabase/ssr`.
- Authorization derives from `auth.getUser()`; client-supplied user IDs and `getSession()` are not trusted.
- Magic links do not create arbitrary accounts; operators invite approved users.
- Garments, shopping screenshots, reference photos, and try-on results use private buckets and short-lived signed URLs.
- Storage deletion happens before database deletion, with retryable deletion records for failed work.
- Unsaved private media is designed to expire after 24 hours once the external retention scheduler is configured.
- Secrets belong in ignored local environment files or the hosting platform—not in source control.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
# or run the non-browser checks together
npm run check
```

`npm test` performs a production build before running the unit and integration suite. Playwright runs mobile and desktop projects against a fresh production server by default.

## Additional documentation

- [Public share pack](docs/SHARE_PACK.md)
- [Testing and demo runbook](TESTING.md)
- [Release notes](docs/RELEASE_NOTES.md)
- [Combined launch architecture](docs/COMBINED_LAUNCH.md)
- [V2 implementation summary](docs/V2_IMPLEMENTATION_SUMMARY.md)
- [Image pipeline](docs/V2_IMAGE_PIPELINE.md)
- [Privacy notes](docs/V2_PRIVACY_NOTES.md)
- [Professional product foundation](docs/PROFESSIONALIZATION_PLAN.md)
- [Provider development](docs/PROVIDER_DEVELOPMENT.md)
- [Privacy and retention](docs/PRIVACY_RETENTION.md)
- [Migration and rollback guide](docs/MIGRATIONS.md)
- [Architecture decisions](docs/adr/0001-open-meteo-weather.md)

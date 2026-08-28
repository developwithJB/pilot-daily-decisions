# Professional product foundation

This document records the prototype-to-product pass completed on 2026-08-27. It supplements, rather than replaces, `COMBINED_LAUNCH.md` and `V2_IMAGE_PIPELINE.md`.

## Product promises

- A new user can complete setup with no paid credentials: Open-Meteo or manual weather, local ICS or manual plans, optional browser-only photos, and clearly labeled example wardrobes.
- Demo output remains deterministic. Example garments stay `inventoryType: "sample"` and the owned-closet engine excludes them.
- Production identity comes from the authenticated server session. Private media uses owner-prefixed private buckets and short-lived signed URLs.
- Try-on and 3D output are styling previews, not body simulation, measurement, garment physics, or fit guarantees.

## Delivered architecture

| Area | Default | Optional live path | Failure behavior |
| --- | --- | --- | --- |
| Weather | Open-Meteo, no key | Open-Meteo city or coordinates | Manual entry with explicit freshness warning |
| Calendar | Manual plan or local ICS normalization | Google OAuth, read only | Skip or manual plan |
| Reference photos | Optional, browser-only in demo | Private Supabase Storage | Skip; exact garment composition remains available |
| Closet scan | Deterministic demo scanner | Authenticated private scan/commit APIs | Manual garment entry and correction |
| Image try-on | Exact composition | OpenAI provider behind flags | Exact composition, never fake photorealism |
| 3D | Local generic fixture | Server-side adapter contract | Disabled state with an actionable explanation |

## Remaining production work

Before enabling live providers, perform the deployment, privacy, retention, and two-user isolation gates in `TESTING.md`. A production 3D provider must add authenticated job persistence, webhook verification or polling, deletion support, expiry enforcement, content policy review, and a signed-URL-only delivery path. Do not expose provider credentials or arbitrary provider URLs to the browser.

## Verification

Run `npm run check` for type, lint, build, and unit/integration coverage. Run `npm run test:e2e` for mobile and desktop onboarding plus the existing decision, closet, history, shopping, and try-on journeys.

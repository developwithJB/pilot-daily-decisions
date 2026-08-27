# pilot: owned-closet decisions on autopilot

Pilot is a mobile-first, invite-only wardrobe assistant. It turns a user’s owned, available closet plus weather, normalized Calendar context, wear history, and feedback into one clear daily outfit decision. It also provides exact-garment outfit boards, screenshot-first shopping guidance, and a rolling seven-day plan.

## Release modes

The combined V1 + V2 bundle is compiled off by default:

```env
NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED=false
LIVE_TRY_ON_ENABLED=false
```

With the bundle off, the app remains a non-persistent generic product preview. Starter garments are local generic assets and are never written to a user’s closet or used by authenticated recommendations.

With the bundle on, every personal screen stops at invite authentication and uses Supabase Auth, Postgres, and private Storage. Live AI try-on remains independently disabled; the launch returns a truthful, interactive 360° exact-garment board labeled **Outfit preview**. The reverse verifies the selected piece list and does not invent garment backs or claim to be a simulated body view.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Do not enable the combined bundle until migrations `0001` through `0004_demo_hardening.sql` are applied and the Supabase URL plus publishable key are configured. Migration `0004` adds the wear, feedback, and shopping idempotency constraints required by the current APIs.

## Production data and auth

- Cookie-based PKCE clients are request-scoped through `@supabase/ssr`.
- Authorization derives from `auth.getUser()`; client user IDs and `getSession()` are not trusted.
- Magic links use `shouldCreateUser: false`; operators invite accounts with `npm run invite -- user@example.com`.
- Garments, shopping screenshots, reference photos, and try-on results use private buckets and five-minute signed URLs.
- Storage deletion happens before database deletion. Failed work remains queryable as a retryable deletion request.
- Unsaved shopping screenshots and try-on results expire after 24 hours once an external scheduler is configured to call the protected maintenance route. Scheduler setup and a production smoke invocation are release-gate requirements.

## Core routes

- `/` — owned-closet daily decision and shopping entry point
- `/week` — rolling seven-day decisions
- `/try-on` — build an exact outfit or open its draggable 360° verification board
- `/closet` — add one item, bulk scan, laundry, and removal
- `/history` — immutable wear snapshots and feedback
- `/settings/model` — private reference-photo controls

The authenticated APIs are documented in [Combined launch architecture](docs/COMBINED_LAUNCH.md).

## Existing-data cutover

The D1/R2 migration is explicit and dry-run first:

```bash
npm run migrate:d1 -- --export /absolute/path/export.json --map /absolute/path/user-map.json
npm run migrate:d1 -- --export /absolute/path/export.json --map /absolute/path/user-map.json --apply
```

Freeze old writes only after dry-run verification. Keep the encrypted read-only backup for 14 days; remove the legacy bindings after migration sign-off. The current hosting file intentionally retains D1/R2 bindings for this rollback window.

## Release gate

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Use a unique `PLAYWRIGHT_PORT` for release runs. Reusing an existing server is opt-in through `PLAYWRIGHT_REUSE_SERVER=true` so stale builds cannot satisfy the gate.

For the Thursday demo, use the disabled-bundle deterministic story on one pre-authenticated, preloaded desktop browser. The Sites deployment is owner-only unless access is deliberately widened. Keep a local production build and the 60–90 second video ready; do not refresh if venue connectivity fails.

See [Testing](TESTING.md) and [Release notes](docs/RELEASE_NOTES.md). A local pass does not replace the Supabase migration/RLS rehearsal, two-user object-isolation test, privacy review, or production smoke test.

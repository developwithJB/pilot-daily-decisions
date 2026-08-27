# Testing and release gate

## Local automated checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`npm test` performs a production build and runs the Node suites. The suites cover owned-only outfit grammar, weather requirements, score/feedback/rotation behavior, missing-category output, shopping thresholds, Calendar normalization, encryption round trips, exact request hashing, state transitions, authenticated API boundaries, and server rendering.

Playwright runs at 390×844 and 1440×900. It checks the direct Add Item path, screenshot-first shopping entry, History’s non-blank preview recovery, one-click Today → 360° preview, slider/front controls, and repeat preview creation after changing a piece. Invite mode is checked separately:

```bash
NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED=true TEST_INVITE_MODE=true \
  npx playwright test tests/e2e/invite.spec.ts --project=mobile --project=desktop
```

## Supabase integration gate

Run against a disposable project after applying migrations `0001`–`0004`:

1. Create two invited users and seed distinct garments and private objects.
2. Prove each user cannot select, update, delete, or sign the other user’s rows or objects.
3. Verify signed URLs expire after five minutes and private bucket paths begin with the owner UUID.
4. Exercise reference-photo delete and delete-all, including a forced partial Storage failure and retry.
5. Verify Calendar refresh-token ciphertext cannot be decrypted with the wrong server key.
6. Run the D1/R2 migration in dry-run mode, then apply it and compare row counts, object counts, UUIDs, SHA-256 hashes, ownership, and signed reads.
7. Confirm a repeated localStorage import with the same payload hash creates no new data.
8. Confirm repeated Wear today, feedback Save, and I bought it actions each produce one record. Verify `0004` deterministically keeps the newest feedback row if rehearsal data contains duplicates.
9. Configure the production scheduler for `POST /api/maintenance/retention` with `Authorization: Bearer $CRON_SECRET`; invoke it once and prove failed Storage deletion leaves database rows for retry.
10. Verify the production Calendar callback URL is in Google’s redirect allowlist and `CALENDAR_TOKEN_ENCRYPTION_KEY` is a base64-encoded 32-byte key before the connect button becomes available.

## Launch sequence

Deploy migrations and the app while `NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED=false`. Smoke-test the disabled bundle, configure and exercise retention scheduling, migrate the invite cohort, repeat two-user isolation checks in production, then rebuild once with the bundle enabled. Keep `LIVE_TRY_ON_ENABLED=false`.

Rollback is a rebuild with the combined flag false. Do not revert additive migrations or delete data created after launch.

## Thursday demo runbook

1. Use the exact deployed URL and presentation browser; verify owner access before screen sharing.
2. Preload Today and complete one private rehearsal in a separate browser tab. Start the audience story from a fresh tab so demo History is clean.
3. Present the deterministic path: Today → Try it on · 360° → drag or tap Full spin → Wear today → History → Add feedback. The exact preview now opens in one click; use Front only if the audience asks to compare the static board.
4. Keep `NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED=false` and `LIVE_TRY_ON_ENABLED=false` for the public story. Do not make Calendar, scanning, shopping vision, or live generation part of the critical five-minute path.
5. Keep the local production server and recorded video ready. If the network drops, switch immediately and do not reload the already-open deployed tab.
6. Audience hands-on access requires an explicit Sites access change or pre-provisioning; owner-only access supports presenter-led use only.

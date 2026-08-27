# Combined V1 + V2 architecture

## Vertical slices

1. **Daily loop:** `/api/bootstrap`, profile, wardrobe, recommendations, wear snapshots, and feedback.
2. **Exact preview:** owned garment IDs and an optional owned reference-photo ID are resolved server-side; no URLs or fallback garments are accepted.
3. **Private lifecycle:** signed reads, Storage-first deletion requests, retry, and 24-hour retention cleanup.
4. **Shopping:** private screenshot extraction, weighted duplicate matching, outfit-gap analysis, and Buy/Save/Skip actions.
5. **Week:** encrypted Google refresh tokens, normalized activities, manual overrides, seven-day weather context, and per-day cached decisions.

## Public API

Authentication: `POST /api/auth/magic-link`, `GET /auth/callback`, `POST /api/auth/sign-out`.

Personal data: `GET /api/bootstrap`, `GET/PATCH /api/profile`, `GET/POST/PATCH/DELETE /api/wardrobe/items`, `POST /api/wardrobe/scan`, `POST /api/wardrobe/commit`, `GET/POST /api/history`, and `PATCH /api/history/:id/feedback`.

Decisions: `POST /api/recommendations`, `POST /api/try-on/jobs`, `GET /api/try-on/jobs/:id`, `POST /api/shopping/analyses`, `GET/PATCH/DELETE /api/shopping/analyses/:id`, and `GET /api/week`.

Context and privacy: `GET/POST/DELETE /api/calendar`, Calendar OAuth connect/callback, `GET/POST /api/deletions/:id`, `GET/POST/DELETE /api/reference-photos`, and `POST /api/maintenance/retention`.

All personal endpoints derive the owner from a validated Supabase user and return private/no-store responses. Failures use `{ error: { code, message, retryable } }`.

## Recommendation contract

`owned_closet_v1` generates only dress + shoes or top + bottom + shoes, with optional/required outerwear. It hard-excludes starter, unowned, inactive, laundry, blocked, context-incompatible, and rain-incompatible pieces. Explanations are generated from the stored deterministic factors. A missing closet category produces one direct CTA instead of a sample substitution.

## Feature flags and providers

- `NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED` gates the entire authenticated combined release.
- `LIVE_TRY_ON_ENABLED` must also be true before an image provider can be selected.
- The launch setting is exact deterministic composition, not a simulated worn image.
- OpenAI may later rerank a narrow top-candidate set only after ID and hard-rule validation; deterministic order remains the fallback.

# Provider development

Provider contracts live in `lib/providers/contracts.ts` and are versioned by `PROVIDER_CONTRACT_VERSION`. Adapters normalize external responses at the server boundary so product code does not depend on vendor payloads.

## Rules for every adapter

1. Implement the relevant interface and return `ProviderResult<T>` with provider, mode, timestamps, confidence, and user-safe warnings.
2. Keep credentials server-only. Never accept a client-supplied owner ID, arbitrary remote media URL, or storage path outside the authenticated user's prefix.
3. Add a deterministic mock or disabled adapter. The application must render a truthful state when credentials are absent.
4. Bound external work with timeouts, small retries, input limits, and rate limits. Redact tokens, image URLs, raw calendar content, and personal metadata from errors and logs.
5. Record model/provider version and provenance on generated artifacts. Expire unsaved private output and support deletion.
6. Test normalization, timeout/failure mapping, authorization, isolation, and disabled mode before enabling a flag.

## Feature flags

| Flag | Meaning | Safe default |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | Use deterministic local fixtures | `true` |
| `NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED` | Enable authenticated Supabase product paths | `false` |
| `LIVE_TRY_ON_ENABLED` | Allow live image provider calls | `false` |
| `TRY_ON_PROVIDER` | Select try-on adapter | `mock` |
| `BACKGROUND_REMOVAL_PROVIDER` | Select cutout adapter | `mock` |
| `AVATAR_3D_ENABLED` | Permit production 3D job creation after review | `false` |
| `AVATAR_3D_PROVIDER` | Select 3D adapter | `disabled` |

Public flags control presentation only; APIs must independently enforce authentication, ownership, configuration, and rate limits.

## Adding a 3D adapter

Implement `Avatar3DProvider`, use only server-resolved private reference-photo paths, create an `avatar_3d_jobs` row, and store the result below `<user-id>/` in `avatar-3d-assets`. Deliver the asset through a short-lived signed URL. GLTF, GLB, and VRM are accepted formats; validate MIME type, magic bytes, file size, and parser limits. The included Three.js viewer provides front/side/back/reset controls and a generic local fallback.

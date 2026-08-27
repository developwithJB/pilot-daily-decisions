# V2 Image Pipeline

## Garment assets

1. Preserve the original upload in private storage.
2. Apply crop and rotation without destroying the original.
3. Run the configured background-removal provider.
4. Normalize to a 1600×2000 transparent canvas with category-aware scale and no cropping.
5. Create a thumbnail for grids and rails.
6. Optionally create a dimensional render.
7. Show Original, Cutout, and Dimensional Render for confirmation.
8. Store provider, status, quality, version, crop, and layout metadata in `garment_assets`.

The presentation uses stable local generated garment photography. The browser applies deterministic category anchors, overlap, rotation, scale, depth, and drop shadows through `OutfitComposition`. Starter assets and My Closet items remain visibly distinguished.

## Background-removal providers

- `mock`: keeps the seeded presentation asset and completes deterministically.
- `rembg_http`: posts a server-side request to `REMBG_SERVICE_URL`.
- `openai`: reserved behind the same provider boundary for a future transparent edit implementation.

The app boots without Python or an external background-removal service.

## Mirror generation

The server creates a persisted job, computes a request hash from the person-photo version, garment versions, look, mode, scene, and prompt version, and checks for a successful equivalent result. It sends one person reference first, followed only by the selected garments.

The prompt requires preservation of identity, face, hair, skin tone, body proportions, pose, hands, camera, lighting, and background, and changes only clothing. It also repeats no body reshaping, retouching, extra garments, text, watermark, or additional people.

## Scene generation

The approved Mirror result becomes the first and only required source. The scene prompt preserves the person and outfit and changes only the normalized environment and environmental light. Exact home addresses and branded venue recreation are not supported.

## Jobs and results

Statuses are `queued`, `validating`, `processing`, `completed`, `failed`, and `cancelled`. Status is persisted before and after provider calls. The client resumes an existing session instead of creating work on refresh or tab changes. Initial creation returns one image; variants require an explicit action.

Production output is written to the private `try-on-results` bucket, thumbnailed, and served with signed URLs. The presentation provider returns clearly labeled seeded private previews and never masquerades as a live provider.

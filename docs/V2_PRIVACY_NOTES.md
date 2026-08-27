# V2 Privacy Notes

## Personal images

Reference photos and generated previews are private user data. Production storage uses the non-public `person-reference-photos` and `try-on-results` buckets. Object names begin with the authenticated user ID and database rows repeat ownership so both Storage policies and table RLS enforce the same boundary.

The client never supplies an authoritative `user_id`. Production writes must resolve the user from the server-side authenticated session. Service-role credentials stay server-only.

## Consent and technical assessment

Before upload, the user confirms they are the person shown or have permission and that the photo may be processed for private outfit previews. Assessment is limited to technical utility: number of visible people, body/face/feet visibility, occlusion, lighting, and resolution.

The product does not infer measurements, weight, age, ethnicity, health, attractiveness, or other sensitive characteristics and does not perform face recognition.

## Data minimization

- Strip EXIF before permanent storage.
- Send the person reference first and only the selected garment images after it.
- Send normalized event/weather facts, not unrelated Calendar descriptions.
- Convert exact private addresses to broad scene categories before a provider request.
- Do not log image bytes, signed photo URLs, prompts, exact addresses, raw Calendar titles, or provider responses.
- Return calm, redacted error codes to the browser.

## Retention and deletion

Reference photos persist until replaced, deactivated, or deleted by the user. Generated previews persist only when the user explicitly saves them or while required for an active job/session. Unsaved production results should have a documented short retention window.

Deleting a reference removes its original, thumbnail, database row, signed access, and dependent generated results where applicable. “Delete all” removes all reference photos, try-on jobs, results, thumbnails, and generation feedback. A virtual try-on is not wear history; only an explicit Wear this action creates a worn record.

## Presentation assets

No personal reference or generated try-on photos are bundled in the repository. The unauthenticated preview uses generic garment assets only. Authenticated personal media belongs in private user-prefixed Storage paths and is returned through five-minute signed URLs.

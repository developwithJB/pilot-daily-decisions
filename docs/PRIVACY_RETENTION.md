# Privacy and retention

Pilot follows data minimization: collect only context required to make a wardrobe decision, keep it private by default, and make deletion understandable.

| Data | Purpose | Storage | Default retention |
| --- | --- | --- | --- |
| City/coordinates | Weather context | Profile or current request | Until changed or account deletion |
| Calendar | Broad activity categories and times | `daily_contexts` | User controlled; raw descriptions, guests, and locations are not stored |
| ICS import | Broad activity categories and times | Browser state unless explicitly saved | Source file is not uploaded by onboarding |
| Garment images | Closet inventory | Private `garments` bucket | Until garment/account deletion |
| Reference photos | Optional preview identity | Private `person-reference-photos` bucket | Until deletion; consent recorded |
| Unsaved try-on output | Styling preview | Private `try-on-results` bucket | 24 hours after configured retention job |
| 3D assets | Optional styling preview | Private `avatar-3d-assets` bucket | 24 hours by default |

Image uploads are re-encoded to WebP in the browser to remove EXIF metadata, validated again by the server, stored under the authenticated user's prefix, and returned only through short-lived signed URLs. Demo onboarding does not persist photo bytes.

Deletion must remove Storage objects before or with database tombstoning. Failures create retryable deletion records. Operators must configure and monitor the protected retention endpoint described in `COMBINED_LAUNCH.md`; a database expiry timestamp alone does not delete an object.

Avoid sensitive or third-party images. Users must own uploaded photos and consent to private preview processing. No generated preview should be used for medical, sizing, tailoring, or identity decisions.

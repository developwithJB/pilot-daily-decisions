# Database migration and rollback

Migrations are append-only and live in `supabase/migrations`. Apply them in numeric order with the Supabase CLI or dashboard against a backed-up staging project first.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

After every migration, run the two-user RLS/storage rehearsal in `TESTING.md`. Confirm anon access is denied, signed URLs expire, and account A cannot select, mutate, or delete account B's rows or objects.

`0005_professional_product_foundation.sql` is additive. It creates onboarding progress, provider-gated 3D jobs/assets, owner-only RLS policies, and a private asset bucket. The application remains compatible if the feature is disabled.

## Rollback

Prefer an application rollback: disable `AVATAR_3D_ENABLED`, deploy the prior application version, and leave additive tables intact. This preserves user data and is the lowest-risk rollback. If schema removal is legally or operationally required, export affected rows, delete Storage objects by verified owner prefix, then remove policies, tables, and the bucket in a separately reviewed migration. Never roll back by weakening RLS or making a bucket public.

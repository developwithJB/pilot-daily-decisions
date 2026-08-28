-- Additive professional-product foundation: resumable setup and provider-gated 3D assets.
-- This migration never makes an existing bucket or table public.

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step text not null default 'weather',
  completed_steps text[] not null default array[]::text[],
  weather_mode text check (weather_mode in ('location','city','manual','skip')),
  calendar_mode text check (calendar_mode in ('google','ics','manual','skip')),
  starter_wardrobe text check (starter_wardrobe in ('menswear','womenswear','neutral','empty')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_3d_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued','processing','ready','failed','disabled','deleted')),
  reference_photo_ids uuid[] not null default array[]::uuid[],
  error_code text,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_3d_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.avatar_3d_jobs(id) on delete cascade,
  asset_path text not null,
  format text not null check (format in ('gltf','glb','vrm')),
  provenance_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  expires_at timestamptz not null default now() + interval '24 hours',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists avatar_3d_jobs_user_status_idx on public.avatar_3d_jobs(user_id,status,created_at desc);
create index if not exists avatar_3d_assets_user_active_idx on public.avatar_3d_assets(user_id,active,created_at desc);

alter table public.onboarding_progress enable row level security;
alter table public.avatar_3d_jobs enable row level security;
alter table public.avatar_3d_assets enable row level security;

create policy "onboarding progress owned" on public.onboarding_progress for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "avatar jobs owned" on public.avatar_3d_jobs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "avatar assets owned" on public.avatar_3d_assets for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant select,insert,update,delete on public.onboarding_progress,public.avatar_3d_jobs,public.avatar_3d_assets to authenticated;
revoke all on public.onboarding_progress,public.avatar_3d_jobs,public.avatar_3d_assets from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatar-3d-assets','avatar-3d-assets',false,52428800,array['model/gltf-binary','model/gltf+json','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "avatar 3d assets owned select" on storage.objects for select to authenticated using(bucket_id='avatar-3d-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "avatar 3d assets owned insert" on storage.objects for insert to authenticated with check(bucket_id='avatar-3d-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "avatar 3d assets owned delete" on storage.objects for delete to authenticated using(bucket_id='avatar-3d-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);

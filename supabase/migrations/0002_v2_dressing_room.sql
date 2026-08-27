create table public.person_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  consent_confirmed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_reference_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_profile_id uuid not null references public.person_profiles(id) on delete cascade,
  image_path text not null,
  thumbnail_path text,
  assessment_json jsonb not null default '{}'::jsonb,
  photo_version integer not null default 1,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.garment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  original_image_path text,
  cutout_image_path text,
  normalized_image_path text,
  studio_render_path text,
  thumbnail_path text,
  background_removal_provider text,
  render_provider text,
  cutout_status text not null default 'pending' check (cutout_status in ('pending','processing','completed','failed')),
  render_status text not null default 'pending' check (render_status in ('pending','processing','completed','failed')),
  quality_score numeric(4,3),
  user_confirmed boolean not null default false,
  source_width integer,
  source_height integer,
  crop_json jsonb not null default '{}'::jsonb,
  layout_json jsonb not null default '{}'::jsonb,
  asset_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outfit_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  layout_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outfit_id, version)
);

create table public.try_on_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null default current_date,
  location_context_json jsonb not null default '{}'::jsonb,
  event_context_json jsonb not null default '{}'::jsonb,
  weather_context_json jsonb not null default '{}'::jsonb,
  calendar_context_json jsonb not null default '{}'::jsonb,
  outfit_id uuid references public.outfits(id) on delete set null,
  reference_photo_id uuid references public.person_reference_photos(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','processing','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.try_on_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.try_on_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('mirror','scene','garment_render')),
  provider text not null,
  provider_model text not null,
  prompt_version text not null,
  status text not null check (status in ('queued','validating','processing','completed','failed','cancelled')),
  error_code text,
  error_message text,
  request_hash text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.try_on_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.try_on_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  thumbnail_path text,
  source_result_id uuid references public.try_on_results(id) on delete set null,
  selected boolean not null default false,
  saved boolean not null default false,
  marked_worn_at timestamptz,
  quality_feedback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scene_presets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  normalized_prompt text not null,
  event_types text[] not null default array[]::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_id uuid not null references public.try_on_results(id) on delete cascade,
  feedback_type text not null,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index person_reference_photos_user_idx on public.person_reference_photos(user_id, active, is_default);
create index garment_assets_garment_idx on public.garment_assets(user_id, garment_id, active);
create index outfit_layouts_user_idx on public.outfit_layouts(user_id, outfit_id);
create index try_on_sessions_user_date_idx on public.try_on_sessions(user_id, session_date desc);
create index try_on_jobs_session_idx on public.try_on_jobs(session_id, created_at desc);
create unique index try_on_jobs_success_hash_idx on public.try_on_jobs(user_id, request_hash) where status = 'completed';
create index try_on_results_user_idx on public.try_on_results(user_id, created_at desc);
create index generation_feedback_result_idx on public.generation_feedback(user_id, result_id);

alter table public.person_profiles enable row level security;
alter table public.person_reference_photos enable row level security;
alter table public.garment_assets enable row level security;
alter table public.outfit_layouts enable row level security;
alter table public.try_on_sessions enable row level security;
alter table public.try_on_jobs enable row level security;
alter table public.try_on_results enable row level security;
alter table public.scene_presets enable row level security;
alter table public.generation_feedback enable row level security;

create policy "person profiles owned" on public.person_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reference photos owned" on public.person_reference_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "garment assets owned" on public.garment_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outfit layouts owned" on public.outfit_layouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "try on sessions owned" on public.try_on_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "try on jobs owned" on public.try_on_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "try on results owned" on public.try_on_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scene presets readable" on public.scene_presets for select using (active = true);
create policy "generation feedback owned" on public.generation_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_person_profiles_updated_at before update on public.person_profiles for each row execute function public.set_updated_at();
create trigger set_person_reference_photos_updated_at before update on public.person_reference_photos for each row execute function public.set_updated_at();
create trigger set_garment_assets_updated_at before update on public.garment_assets for each row execute function public.set_updated_at();
create trigger set_outfit_layouts_updated_at before update on public.outfit_layouts for each row execute function public.set_updated_at();
create trigger set_try_on_sessions_updated_at before update on public.try_on_sessions for each row execute function public.set_updated_at();
create trigger set_try_on_jobs_updated_at before update on public.try_on_jobs for each row execute function public.set_updated_at();
create trigger set_try_on_results_updated_at before update on public.try_on_results for each row execute function public.set_updated_at();
create trigger set_scene_presets_updated_at before update on public.scene_presets for each row execute function public.set_updated_at();
create trigger set_generation_feedback_updated_at before update on public.generation_feedback for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public) values
  ('person-reference-photos','person-reference-photos',false),
  ('try-on-results','try-on-results',false)
on conflict (id) do nothing;

create policy "reference storage readable by owner" on storage.objects for select using (bucket_id = 'person-reference-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reference storage insertable by owner" on storage.objects for insert with check (bucket_id = 'person-reference-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reference storage deletable by owner" on storage.objects for delete using (bucket_id = 'person-reference-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "try on storage readable by owner" on storage.objects for select using (bucket_id = 'try-on-results' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "try on storage insertable by owner" on storage.objects for insert with check (bucket_id = 'try-on-results' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "try on storage deletable by owner" on storage.objects for delete using (bucket_id = 'try-on-results' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.scene_presets (slug, label, normalized_prompt, event_types) values
  ('modern-office','Modern office','modern city office with quiet natural light',array['office']),
  ('west-loop-dinner','Dinner in the West Loop','warm contemporary Chicago restaurant at early evening',array['dinner','date']),
  ('rooftop-evening','Rooftop evening','refined city rooftop at blue hour',array['party','date']),
  ('wedding-venue','Wedding venue','elegant neutral event venue',array['wedding']),
  ('airport','Airport','bright modern airport concourse without brand signage',array['travel']),
  ('neutral-studio','Neutral studio','warm neutral editorial studio',array['custom']);

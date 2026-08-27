create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Sydney',
  home_location text,
  work_location text,
  style_preferences jsonb not null default '{}'::jsonb,
  temperature_sensitivity smallint not null default 0 check (temperature_sensitivity between -2 and 2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google', provider_account_id text,
  encrypted_refresh_token text, scopes text[] not null default array[]::text[], connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table public.garments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, brand text, category text not null, subcategory text, color text,
  material text, material_confidence text not null default 'inferred' check (material_confidence in ('confirmed','inferred')),
  warmth_score smallint not null check (warmth_score between 1 and 5),
  formality_score smallint not null check (formality_score between 1 and 5),
  seasons text[] not null default array[]::text[], occasions text[] not null default array[]::text[],
  rain_compatible boolean not null default false, image_path text, retailer_url text,
  inventory_type text not null default 'owned' check (inventory_type in ('owned','sample')),
  laundry_status boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.outfits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.outfit_items (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  layer_order smallint not null default 0, primary key (outfit_id, garment_id)
);

create table public.daily_contexts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  context_date date not null, location text, source text not null default 'manual',
  day_type text, activities jsonb not null default '[]'::jsonb, weather jsonb not null default '{}'::jsonb,
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, context_date)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  daily_context_id uuid not null references public.daily_contexts(id) on delete cascade,
  recommendation_type text not null check (recommendation_type in ('best_overall','most_polished','most_comfortable')),
  rank smallint not null check (rank between 1 and 3), reason text not null, weather_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(daily_context_id, rank)
);
create table public.recommendation_items (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  layer_order smallint not null default 0, primary key (recommendation_id, garment_id)
);

create table public.wear_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id uuid references public.outfits(id) on delete set null,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  worn_on date not null, context_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  wear_history_id uuid references public.wear_history(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  temperature_feedback text check (temperature_feedback in ('too_cold','perfect','too_warm')),
  style_feedback text check (style_feedback in ('loved','not_for_me')),
  rejection_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index garments_user_category_idx on public.garments(user_id, category) where active = true;
create index garments_user_laundry_idx on public.garments(user_id, laundry_status);
create index daily_contexts_user_date_idx on public.daily_contexts(user_id, context_date desc);
create index recommendations_context_idx on public.recommendations(daily_context_id, rank);
create index wear_history_user_date_idx on public.wear_history(user_id, worn_on desc);
create index feedback_user_idx on public.feedback(user_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','calendar_connections','garments','outfits','outfit_items','daily_contexts','recommendations','recommendation_items','wear_history','feedback'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "profiles owned" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "calendar owned" on public.calendar_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "garments owned" on public.garments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outfits owned" on public.outfits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outfit items owned" on public.outfit_items for all using (exists(select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid())) with check (exists(select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid()));
create policy "contexts owned" on public.daily_contexts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recommendations owned" on public.recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recommendation items owned" on public.recommendation_items for all using (exists(select 1 from public.recommendations r where r.id = recommendation_id and r.user_id = auth.uid())) with check (exists(select 1 from public.recommendations r where r.id = recommendation_id and r.user_id = auth.uid()));
create policy "wear history owned" on public.wear_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback owned" on public.feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','calendar_connections','garments','outfits','daily_contexts','recommendations','wear_history','feedback'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public) values ('garments','garments',false) on conflict (id) do nothing;
create policy "garment images readable by owner" on storage.objects for select using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "garment images insertable by owner" on storage.objects for insert with check (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "garment images editable by owner" on storage.objects for update using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "garment images deletable by owner" on storage.objects for delete using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);

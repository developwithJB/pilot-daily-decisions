-- Additive safeguards discovered during the combined-roadmap demo QA.
-- Kept separate from 0003 so already-migrated environments receive them.

alter table public.wear_history
  add column if not exists outfit_hash text;

create unique index if not exists wear_history_user_day_outfit_idx
  on public.wear_history(user_id, worn_on, outfit_hash)
  where outfit_hash is not null;

with ranked_feedback as (
  select id,
    row_number() over (
      partition by user_id, wear_history_id
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.feedback
)
delete from public.feedback
where id in (
  select id from ranked_feedback where duplicate_rank > 1
);

create unique index if not exists feedback_wear_history_unique_idx
  on public.feedback(user_id, wear_history_id);

alter table public.shopping_analyses
  add column if not exists purchased_garment_id uuid
  references public.garments(id) on delete set null;

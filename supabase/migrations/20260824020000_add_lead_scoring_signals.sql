begin;

-- Persist only the source facts used by the local scoring function. The score,
-- breakdown and confidence remain derived values and are never stored.
alter table public.leads
  add column email text,
  add column facebook text,
  add column business_categories text[] not null default '{}'::text[],
  add column rating numeric(3, 2) check (rating is null or rating between 0 and 5),
  add column review_count integer check (review_count is null or review_count >= 0),
  add column social_links text[] not null default '{}'::text[],
  add column digital_presence_known boolean not null default false;

commit;

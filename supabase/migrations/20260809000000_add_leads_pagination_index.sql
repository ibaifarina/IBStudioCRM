begin;

drop index if exists public.leads_user_updated_idx;

create index leads_user_updated_idx
  on public.leads (user_id, updated_at desc, id desc);

commit;

begin;

create index if not exists leads_user_created_idx
  on public.leads (user_id, created_at desc, id desc);

create index if not exists leads_user_name_idx
  on public.leads (user_id, name, id);

commit;

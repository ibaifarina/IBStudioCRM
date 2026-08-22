begin;

create table public.message_templates (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  icon text not null default 'message-square-text'
    check (char_length(trim(icon)) between 1 and 80),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_id_user_unique unique (id, user_id)
);

create unique index message_templates_user_name_unique
  on public.message_templates (user_id, lower(name));
create index message_templates_user_updated_idx
  on public.message_templates (user_id, updated_at desc);

alter table public.message_templates enable row level security;

create policy "Account owners manage their message templates"
  on public.message_templates
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.message_templates from anon;
grant select, insert, update, delete
  on table public.message_templates
  to authenticated;
grant usage, select on sequence public.message_templates_id_seq to authenticated;

commit;

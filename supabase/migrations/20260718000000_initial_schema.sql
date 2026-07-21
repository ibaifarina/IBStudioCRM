begin;

create table public.leads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  instagram text,
  website text,
  phone text,
  address text,
  lat double precision,
  lng double precision,
  problem text,
  notes text,
  status text not null default 'por_contactar' check (
    status in (
      'por_contactar',
      'contactado',
      'seguimiento',
      'respondio',
      'cliente',
      'descartado'
    )
  ),
  contact_date date,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_id_user_unique unique (id, user_id)
);

create table public.tags (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  constraint tags_id_user_unique unique (id, user_id)
);

create unique index tags_user_name_unique
  on public.tags (user_id, lower(name));

create table public.lead_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id bigint not null,
  tag_id bigint not null,
  primary key (lead_id, tag_id),
  constraint lead_tags_lead_owner_fk
    foreign key (lead_id, user_id)
    references public.leads (id, user_id)
    on delete cascade,
  constraint lead_tags_tag_owner_fk
    foreign key (tag_id, user_id)
    references public.tags (id, user_id)
    on delete cascade
);

create index leads_user_updated_idx
  on public.leads (user_id, updated_at desc);
create index leads_user_status_idx
  on public.leads (user_id, status);
create index leads_user_follow_up_idx
  on public.leads (user_id, follow_up_date);
create index tags_user_idx
  on public.tags (user_id);
create index lead_tags_user_idx
  on public.lead_tags (user_id);
create index lead_tags_tag_idx
  on public.lead_tags (tag_id);

alter table public.leads enable row level security;
alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;

create policy "Account owners manage their leads"
  on public.leads
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Account owners manage their tags"
  on public.tags
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Account owners manage their lead tags"
  on public.lead_tags
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.leads, public.tags, public.lead_tags from anon;
grant select, insert, update, delete
  on table public.leads, public.tags, public.lead_tags
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;

begin;

create table public.lead_change_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 180),
  lead_count integer not null check (lead_count > 0),
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  restores_change_set_id bigint references public.lead_change_sets (id) on delete set null
);

create table public.lead_versions (
  id bigint generated always as identity primary key,
  change_set_id bigint not null references public.lead_change_sets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id bigint not null,
  existed boolean not null,
  snapshot jsonb,
  tag_ids bigint[] not null default '{}',
  constraint lead_versions_snapshot_check check (
    (existed and snapshot is not null) or (not existed and snapshot is null)
  ),
  constraint lead_versions_change_set_lead_unique unique (change_set_id, lead_id)
);

create index lead_change_sets_user_created_idx
  on public.lead_change_sets (user_id, created_at desc);
create index lead_versions_user_lead_idx
  on public.lead_versions (user_id, lead_id);

alter table public.lead_change_sets enable row level security;
alter table public.lead_versions enable row level security;

create policy "Account owners read their lead change sets"
  on public.lead_change_sets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Account owners read their lead versions"
  on public.lead_versions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.lead_change_sets, public.lead_versions from anon;
grant select on table public.lead_change_sets, public.lead_versions to authenticated;

create or replace function public.capture_lead_change_set(
  p_lead_ids bigint[],
  p_description text,
  p_existed boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ids bigint[];
  v_change_set_id bigint;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select coalesce(array_agg(candidate.id order by candidate.id), '{}'::bigint[])
  into v_ids
  from (
    select distinct id
    from unnest(coalesce(p_lead_ids, '{}'::bigint[])) as requested(id)
    where id > 0
  ) as candidate;

  v_count := cardinality(v_ids);
  if v_count = 0 or v_count > 5000 then
    raise exception 'A change set must contain between 1 and 5000 leads'
      using errcode = '22023';
  end if;

  if p_description is null or char_length(trim(p_description)) not between 1 and 180 then
    raise exception 'Invalid change description' using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.leads
    where user_id = v_user_id and id = any(v_ids)
  ) <> v_count then
    raise exception 'One or more leads are unavailable' using errcode = '42501';
  end if;

  insert into public.lead_change_sets (user_id, description, lead_count)
  values (v_user_id, trim(p_description), v_count)
  returning id into v_change_set_id;

  if p_existed then
    insert into public.lead_versions (
      change_set_id,
      user_id,
      lead_id,
      existed,
      snapshot,
      tag_ids
    )
    select
      v_change_set_id,
      v_user_id,
      lead.id,
      true,
      to_jsonb(lead),
      coalesce(
        (
          select array_agg(link.tag_id order by link.tag_id)
          from public.lead_tags as link
          where link.user_id = v_user_id and link.lead_id = lead.id
        ),
        '{}'::bigint[]
      )
    from public.leads as lead
    where lead.user_id = v_user_id and lead.id = any(v_ids);
  else
    insert into public.lead_versions (
      change_set_id,
      user_id,
      lead_id,
      existed,
      snapshot,
      tag_ids
    )
    select v_change_set_id, v_user_id, id, false, null, '{}'::bigint[]
    from unnest(v_ids) as created(id);
  end if;

  return v_change_set_id;
end;
$$;

create or replace function public.restore_lead_change_set(p_change_set_id bigint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.lead_change_sets%rowtype;
  v_inverse_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_original
  from public.lead_change_sets
  where id = p_change_set_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Change set not found' using errcode = 'P0002';
  end if;
  if v_original.restored_at is not null then
    raise exception 'This change set was already restored' using errcode = '22023';
  end if;

  insert into public.lead_change_sets (
    user_id,
    description,
    lead_count,
    restores_change_set_id
  )
  values (
    v_user_id,
    left('Restauración de: ' || v_original.description, 180),
    v_original.lead_count,
    v_original.id
  )
  returning id into v_inverse_id;

  insert into public.lead_versions (
    change_set_id,
    user_id,
    lead_id,
    existed,
    snapshot,
    tag_ids
  )
  select
    v_inverse_id,
    v_user_id,
    version.lead_id,
    current_lead.id is not null,
    case when current_lead.id is null then null else to_jsonb(current_lead) end,
    coalesce(
      (
        select array_agg(link.tag_id order by link.tag_id)
        from public.lead_tags as link
        where link.user_id = v_user_id and link.lead_id = version.lead_id
      ),
      '{}'::bigint[]
    )
  from public.lead_versions as version
  left join public.leads as current_lead
    on current_lead.id = version.lead_id and current_lead.user_id = v_user_id
  where version.change_set_id = v_original.id and version.user_id = v_user_id;

  delete from public.lead_tags as link
  using public.lead_versions as version
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and link.user_id = v_user_id
    and link.lead_id = version.lead_id;

  delete from public.leads as lead
  using public.lead_versions as version
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and not version.existed
    and lead.user_id = v_user_id
    and lead.id = version.lead_id;

  update public.leads as lead
  set
    name = version.snapshot ->> 'name',
    instagram = version.snapshot ->> 'instagram',
    website = version.snapshot ->> 'website',
    website_status = version.snapshot ->> 'website_status',
    phone = version.snapshot ->> 'phone',
    address = version.snapshot ->> 'address',
    lat = (version.snapshot ->> 'lat')::double precision,
    lng = (version.snapshot ->> 'lng')::double precision,
    problem = version.snapshot ->> 'problem',
    notes = version.snapshot ->> 'notes',
    status = version.snapshot ->> 'status',
    contact_date = (version.snapshot ->> 'contact_date')::date,
    follow_up_date = (version.snapshot ->> 'follow_up_date')::date,
    created_at = (version.snapshot ->> 'created_at')::timestamptz,
    updated_at = now()
  from public.lead_versions as version
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and version.existed
    and lead.user_id = v_user_id
    and lead.id = version.lead_id;

  insert into public.leads (
    id,
    user_id,
    name,
    instagram,
    website,
    website_status,
    phone,
    address,
    lat,
    lng,
    problem,
    notes,
    status,
    contact_date,
    follow_up_date,
    created_at,
    updated_at
  ) overriding system value
  select
    version.lead_id,
    v_user_id,
    version.snapshot ->> 'name',
    version.snapshot ->> 'instagram',
    version.snapshot ->> 'website',
    version.snapshot ->> 'website_status',
    version.snapshot ->> 'phone',
    version.snapshot ->> 'address',
    (version.snapshot ->> 'lat')::double precision,
    (version.snapshot ->> 'lng')::double precision,
    version.snapshot ->> 'problem',
    version.snapshot ->> 'notes',
    version.snapshot ->> 'status',
    (version.snapshot ->> 'contact_date')::date,
    (version.snapshot ->> 'follow_up_date')::date,
    (version.snapshot ->> 'created_at')::timestamptz,
    now()
  from public.lead_versions as version
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and version.existed
    and not exists (
      select 1
      from public.leads as current_lead
      where current_lead.id = version.lead_id
    );

  insert into public.lead_tags (user_id, lead_id, tag_id)
  select v_user_id, version.lead_id, saved_tag.id
  from public.lead_versions as version
  cross join lateral unnest(version.tag_ids) as saved(tag_id)
  join public.tags as saved_tag
    on saved_tag.id = saved.tag_id and saved_tag.user_id = v_user_id
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and version.existed
  on conflict (lead_id, tag_id) do nothing;

  update public.lead_change_sets
  set restored_at = now()
  where id = v_original.id;

  return v_original.lead_count;
end;
$$;

revoke all on function public.capture_lead_change_set(bigint[], text, boolean) from public;
revoke all on function public.restore_lead_change_set(bigint) from public;
grant execute on function public.capture_lead_change_set(bigint[], text, boolean) to authenticated;
grant execute on function public.restore_lead_change_set(bigint) to authenticated;

commit;

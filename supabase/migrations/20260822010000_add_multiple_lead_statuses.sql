begin;

alter table public.leads
  add column statuses text[];

update public.leads
set statuses = array[status]
where statuses is null;

alter table public.leads
  alter column statuses set default array['por_contactar']::text[],
  alter column statuses set not null,
  add constraint leads_statuses_check check (
    cardinality(statuses) between 1 and 7
    and statuses <@ array[
      'por_contactar',
      'revisar_mas_tarde',
      'contactado',
      'seguimiento',
      'respondio',
      'cliente',
      'descartado'
    ]::text[]
  );

create index leads_user_statuses_idx
  on public.leads using gin (statuses);

create or replace function public.sync_lead_primary_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.statuses is null or cardinality(new.statuses) = 0 then
    new.statuses := array[coalesce(new.status, 'por_contactar')];
  elsif tg_op = 'INSERT' or new.statuses is distinct from old.statuses then
    new.status := new.statuses[1];
  elsif new.status is distinct from old.status then
    new.statuses := array[new.status];
  end if;
  return new;
end;
$$;

create trigger sync_lead_primary_status_trigger
before insert or update of status, statuses on public.leads
for each row execute function public.sync_lead_primary_status();

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
    statuses = case
      when jsonb_typeof(version.snapshot -> 'statuses') = 'array'
      then array(
        select jsonb_array_elements_text(version.snapshot -> 'statuses')
      )
      else array[version.snapshot ->> 'status']
    end,
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
    statuses,
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
    case
      when jsonb_typeof(version.snapshot -> 'statuses') = 'array'
      then array(
        select jsonb_array_elements_text(version.snapshot -> 'statuses')
      )
      else array[version.snapshot ->> 'status']
    end,
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

commit;

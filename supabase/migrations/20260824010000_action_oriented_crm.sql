begin;

alter table public.leads
  add column contacted_at timestamptz,
  add column replied_at timestamptz,
  add column last_contact_at timestamptz,
  add column last_outbound_at timestamptz,
  add column last_inbound_at timestamptz,
  add column contact_channel text,
  add column next_action text,
  add column next_action_at timestamptz,
  add column source text,
  add column google_place_id text,
  add column normalized_phone text,
  add column normalized_instagram text,
  add column website_domain text;

create or replace function public.normalize_crm_phone(p_phone text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits
  ), international as (
    select case
      when digits like '00%' then substr(digits, 3)
      when char_length(digits) = 9 then '34' || digits
      else digits
    end as digits
    from cleaned
  )
  select case
    when char_length(digits) between 8 and 15 then '+' || digits
    else null
  end
  from international;
$$;

create or replace function public.map_crm_status(
  p_status text,
  p_statuses text[] default null
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_status = 'descartado' then 'descartado'
    when coalesce(p_statuses, '{}'::text[]) @> array['cliente']::text[]
      or p_status = 'cliente' then 'cliente'
    when coalesce(p_statuses, '{}'::text[]) @> array['interesado']::text[]
      or p_status = 'interesado' then 'interesado'
    when coalesce(p_statuses, '{}'::text[]) @> array['respondio']::text[]
      or p_status = 'respondio' then 'respondio'
    when coalesce(p_statuses, '{}'::text[]) && array['contactado', 'seguimiento']::text[]
      or p_status in ('contactado', 'seguimiento') then 'contactado'
    when coalesce(p_statuses, '{}'::text[]) @> array['descartado']::text[]
      then 'descartado'
    else 'por_contactar'
  end;
$$;

with mapped as (
  select
    id,
    public.map_crm_status(status, statuses) as commercial_status,
    case
      when public.map_crm_status(status, statuses) in ('cliente', 'descartado')
        then 'sin_accion'
      when statuses @> array['revisar_mas_tarde']::text[]
        or status = 'revisar_mas_tarde' then 'revisar_mas_tarde'
      when statuses @> array['seguimiento']::text[]
        or status = 'seguimiento' then 'hacer_follow_up'
      when public.map_crm_status(status, statuses) = 'respondio' then 'responder'
      when public.map_crm_status(status, statuses) = 'interesado' then 'hacer_follow_up'
      when public.map_crm_status(status, statuses) = 'contactado'
        and follow_up_date is not null then 'hacer_follow_up'
      when public.map_crm_status(status, statuses) = 'contactado'
        then 'esperar_respuesta'
      else 'contactar'
    end as mapped_next_action
  from public.leads
)
update public.leads as lead
set
  status = mapped.commercial_status,
  statuses = array[mapped.commercial_status],
  contacted_at = case
    when lead.contact_date is null then null
    else (lead.contact_date + time '09:00') at time zone 'Europe/Madrid'
  end,
  last_contact_at = case
    when lead.contact_date is null then null
    else (lead.contact_date + time '09:00') at time zone 'Europe/Madrid'
  end,
  last_outbound_at = case
    when lead.contact_date is null then null
    else (lead.contact_date + time '09:00') at time zone 'Europe/Madrid'
  end,
  next_action = mapped.mapped_next_action,
  next_action_at = case
    when mapped.mapped_next_action = 'sin_accion' or lead.follow_up_date is null
      then null
    else (lead.follow_up_date + time '09:00') at time zone 'Europe/Madrid'
  end,
  source = 'manual',
  normalized_phone = public.normalize_crm_phone(lead.phone),
  normalized_instagram = nullif(lower(regexp_replace(coalesce(lead.instagram, ''), '^@', '')), ''),
  website_domain = nullif(
    lower(
      regexp_replace(
        regexp_replace(coalesce(lead.website, ''), '^https?://(www\.)?', '', 'i'),
        '[/?:#].*$',
        ''
      )
    ),
    ''
  )
from mapped
where lead.id = mapped.id;

alter table public.leads
  drop constraint if exists leads_status_check,
  drop constraint if exists leads_statuses_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'por_contactar',
      'contactado',
      'respondio',
      'interesado',
      'cliente',
      'descartado'
    )
  ),
  add constraint leads_statuses_check check (
    cardinality(statuses) = 1
    and statuses <@ array[
      'por_contactar',
      'contactado',
      'respondio',
      'interesado',
      'cliente',
      'descartado'
    ]::text[]
  ),
  alter column next_action set default 'contactar',
  alter column next_action set not null,
  add constraint leads_next_action_check check (
    next_action in (
      'contactar',
      'esperar_respuesta',
      'hacer_follow_up',
      'responder',
      'revisar_mas_tarde',
      'sin_accion'
    )
  ),
  add constraint leads_contact_channel_check check (
    contact_channel is null or contact_channel in (
      'whatsapp', 'instagram', 'phone', 'other'
    )
  ),
  alter column source set default 'manual',
  alter column source set not null,
  add constraint leads_source_check check (
    source in (
      'google_maps', 'instagram', 'manual', 'importacion',
      'apify', 'referral', 'other'
    )
  );

drop trigger if exists sync_lead_primary_status_trigger on public.leads;

create or replace function public.sync_lead_primary_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_requested_status text := coalesce(new.status, 'por_contactar');
  v_requested_statuses text[] := coalesce(new.statuses, '{}'::text[]);
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status
    or new.statuses is distinct from old.statuses then
    new.status := public.map_crm_status(v_requested_status, new.statuses);
    new.statuses := array[new.status];

    if new.status in ('cliente', 'descartado') then
      new.next_action := 'sin_accion';
      new.next_action_at := null;
    elsif v_requested_status = 'seguimiento'
      or v_requested_statuses @> array['seguimiento']::text[] then
      new.next_action := 'hacer_follow_up';
    elsif v_requested_status = 'revisar_mas_tarde'
      or v_requested_statuses @> array['revisar_mas_tarde']::text[] then
      new.next_action := 'revisar_mas_tarde';
    elsif tg_op = 'INSERT' and new.next_action = 'contactar' then
      new.next_action := case
        when new.status = 'contactado' and new.follow_up_date is not null
          then 'hacer_follow_up'
        when new.status = 'contactado' then 'esperar_respuesta'
        when new.status = 'respondio' then 'responder'
        when new.status = 'interesado' then 'hacer_follow_up'
        else new.next_action
      end;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.contacted_at is null and new.contact_date is not null then
      new.contacted_at := (new.contact_date + time '09:00') at time zone 'Europe/Madrid';
    end if;
    if new.contacted_at is not null then
      new.contact_date := (new.contacted_at at time zone 'Europe/Madrid')::date;
    end if;
    if new.next_action_at is null and new.follow_up_date is not null then
      new.next_action_at := (new.follow_up_date + time '09:00') at time zone 'Europe/Madrid';
    end if;
    if new.next_action_at is not null then
      new.follow_up_date := (new.next_action_at at time zone 'Europe/Madrid')::date;
    end if;
  else
    if new.contacted_at is distinct from old.contacted_at then
      new.contact_date := case
        when new.contacted_at is null then null
        else (new.contacted_at at time zone 'Europe/Madrid')::date
      end;
    elsif new.contact_date is distinct from old.contact_date then
      new.contacted_at := case
        when new.contact_date is null then null
        else (new.contact_date + time '09:00') at time zone 'Europe/Madrid'
      end;
    end if;

    if new.next_action_at is distinct from old.next_action_at then
      new.follow_up_date := case
        when new.next_action_at is null then null
        else (new.next_action_at at time zone 'Europe/Madrid')::date
      end;
    elsif new.follow_up_date is distinct from old.follow_up_date then
      new.next_action_at := case
        when new.follow_up_date is null then null
        else (new.follow_up_date + time '09:00') at time zone 'Europe/Madrid'
      end;
    end if;
  end if;

  new.normalized_phone := public.normalize_crm_phone(new.phone);
  new.normalized_instagram := nullif(
    lower(regexp_replace(coalesce(new.instagram, ''), '^@', '')),
    ''
  );
  new.website_domain := nullif(
    lower(
      regexp_replace(
        regexp_replace(coalesce(new.website, ''), '^https?://(www\.)?', '', 'i'),
        '[/?:#].*$',
        ''
      )
    ),
    ''
  );

  return new;
end;
$$;

create trigger sync_lead_primary_status_trigger
before insert or update on public.leads
for each row execute function public.sync_lead_primary_status();

create index leads_user_next_action_idx
  on public.leads (user_id, next_action, next_action_at);
create index leads_user_last_contact_idx
  on public.leads (user_id, last_contact_at desc);
create index leads_user_normalized_phone_idx
  on public.leads (user_id, normalized_phone)
  where normalized_phone is not null;
create index leads_user_normalized_instagram_idx
  on public.leads (user_id, normalized_instagram)
  where normalized_instagram is not null;
create index leads_user_website_domain_idx
  on public.leads (user_id, website_domain)
  where website_domain is not null;
create index leads_user_google_place_id_idx
  on public.leads (user_id, google_place_id)
  where google_place_id is not null;

create table public.lead_activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id bigint not null,
  type text not null check (type ~ '^[a-z][a-z0-9_]{0,79}$'),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  description text check (
    description is null or char_length(description) between 1 and 2000
  ),
  origin text,
  template_id bigint,
  constraint lead_activities_lead_owner_fk
    foreign key (lead_id, user_id)
    references public.leads (id, user_id)
    on delete cascade,
  constraint lead_activities_template_owner_fk
    foreign key (template_id, user_id)
    references public.message_templates (id, user_id)
    on delete set null (template_id)
);

create index lead_activities_user_lead_occurred_idx
  on public.lead_activities (user_id, lead_id, occurred_at desc, id desc);
create index lead_activities_user_type_idx
  on public.lead_activities (user_id, type, occurred_at desc);
create index lead_activities_template_idx
  on public.lead_activities (user_id, template_id, occurred_at desc)
  where template_id is not null;

alter table public.lead_activities enable row level security;

create policy "Account owners manage their lead activities"
  on public.lead_activities
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.lead_activities from anon;
grant select, insert, update, delete on table public.lead_activities to authenticated;
grant usage, select on sequence public.lead_activities_id_seq to authenticated;

insert into public.lead_activities (
  user_id, lead_id, type, occurred_at, metadata, origin
)
select user_id, id, 'lead_created', created_at, '{}'::jsonb, 'migration'
from public.leads;

insert into public.lead_activities (
  user_id, lead_id, type, occurred_at, metadata, origin
)
select
  user_id,
  id,
  'contact_marked',
  contacted_at,
  jsonb_strip_nulls(jsonb_build_object('channel', contact_channel)),
  'migration'
from public.leads
where contacted_at is not null;

create or replace function public.log_lead_crm_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_activities (
      user_id, lead_id, type, occurred_at, metadata, origin
    ) values (
      new.user_id, new.id, 'lead_created', new.created_at, '{}'::jsonb, 'app'
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.lead_activities (
      user_id, lead_id, type, metadata, origin
    ) values (
      new.user_id,
      new.id,
      'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status),
      'app'
    );
  end if;

  if new.next_action is distinct from old.next_action
    or new.next_action_at is distinct from old.next_action_at then
    insert into public.lead_activities (
      user_id, lead_id, type, metadata, origin
    ) values (
      new.user_id,
      new.id,
      case
        when old.next_action = 'hacer_follow_up'
          and new.next_action = 'sin_accion' then 'followup_completed'
        when new.next_action = 'hacer_follow_up'
          and new.next_action_at is not null then 'followup_scheduled'
        else 'next_action_changed'
      end,
      jsonb_strip_nulls(
        jsonb_build_object(
          'from', old.next_action,
          'to', new.next_action,
          'scheduled_at', new.next_action_at
        )
      ),
      'app'
    );
  end if;

  if new.contacted_at is distinct from old.contacted_at
    and new.contacted_at is not null then
    insert into public.lead_activities (
      user_id, lead_id, type, occurred_at, metadata, origin
    ) values (
      new.user_id,
      new.id,
      'contact_marked',
      new.contacted_at,
      jsonb_strip_nulls(jsonb_build_object('channel', new.contact_channel)),
      'manual'
    );
  end if;

  if new.replied_at is distinct from old.replied_at
    and new.replied_at is not null then
    insert into public.lead_activities (
      user_id, lead_id, type, occurred_at, metadata, origin
    ) values (
      new.user_id,
      new.id,
      'reply_marked',
      new.replied_at,
      jsonb_strip_nulls(jsonb_build_object('channel', new.contact_channel)),
      'manual'
    );
  end if;

  return new;
end;
$$;

create trigger log_lead_crm_activity_trigger
after insert or update on public.leads
for each row execute function public.log_lead_crm_activity();

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

  select * into v_original
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
    user_id, description, lead_count, restores_change_set_id
  ) values (
    v_user_id,
    left('Restauración de: ' || v_original.description, 180),
    v_original.lead_count,
    v_original.id
  ) returning id into v_inverse_id;

  insert into public.lead_versions (
    change_set_id, user_id, lead_id, existed, snapshot, tag_ids
  )
  select
    v_inverse_id,
    v_user_id,
    version.lead_id,
    current_lead.id is not null,
    case when current_lead.id is null then null else to_jsonb(current_lead) end,
    coalesce((
      select array_agg(link.tag_id order by link.tag_id)
      from public.lead_tags as link
      where link.user_id = v_user_id and link.lead_id = version.lead_id
    ), '{}'::bigint[])
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
    website_status = coalesce(version.snapshot ->> 'website_status', 'sin_revisar'),
    phone = version.snapshot ->> 'phone',
    address = version.snapshot ->> 'address',
    lat = (version.snapshot ->> 'lat')::double precision,
    lng = (version.snapshot ->> 'lng')::double precision,
    problem = version.snapshot ->> 'problem',
    notes = version.snapshot ->> 'notes',
    status = coalesce(version.snapshot ->> 'status', 'por_contactar'),
    statuses = case
      when jsonb_typeof(version.snapshot -> 'statuses') = 'array'
      then array(select jsonb_array_elements_text(version.snapshot -> 'statuses'))
      else array[coalesce(version.snapshot ->> 'status', 'por_contactar')]
    end,
    contact_date = (version.snapshot ->> 'contact_date')::date,
    follow_up_date = (version.snapshot ->> 'follow_up_date')::date,
    contacted_at = coalesce(
      (version.snapshot ->> 'contacted_at')::timestamptz,
      case when version.snapshot ->> 'contact_date' is null then null
        else ((version.snapshot ->> 'contact_date')::date + time '09:00')
          at time zone 'Europe/Madrid' end
    ),
    replied_at = (version.snapshot ->> 'replied_at')::timestamptz,
    last_contact_at = (version.snapshot ->> 'last_contact_at')::timestamptz,
    last_outbound_at = (version.snapshot ->> 'last_outbound_at')::timestamptz,
    last_inbound_at = (version.snapshot ->> 'last_inbound_at')::timestamptz,
    contact_channel = version.snapshot ->> 'contact_channel',
    next_action = coalesce(
      version.snapshot ->> 'next_action',
      case
        when version.snapshot ->> 'status' in ('cliente', 'descartado')
          or coalesce(version.snapshot -> 'statuses', '[]'::jsonb)
            ?| array['cliente', 'descartado']
          then 'sin_accion'
        when version.snapshot ->> 'status' = 'revisar_mas_tarde'
          or coalesce(version.snapshot -> 'statuses', '[]'::jsonb)
            ? 'revisar_mas_tarde' then 'revisar_mas_tarde'
        when version.snapshot ->> 'status' = 'seguimiento'
          or coalesce(version.snapshot -> 'statuses', '[]'::jsonb)
            ? 'seguimiento' then 'hacer_follow_up'
        when version.snapshot ->> 'status' = 'respondio' then 'responder'
        when version.snapshot ->> 'status' = 'interesado' then 'hacer_follow_up'
        when version.snapshot ->> 'status' = 'contactado'
          and version.snapshot ->> 'follow_up_date' is not null
          then 'hacer_follow_up'
        when version.snapshot ->> 'status' = 'contactado'
          then 'esperar_respuesta'
        else 'contactar'
      end
    ),
    next_action_at = coalesce(
      (version.snapshot ->> 'next_action_at')::timestamptz,
      case when version.snapshot ->> 'follow_up_date' is null then null
        else ((version.snapshot ->> 'follow_up_date')::date + time '09:00')
          at time zone 'Europe/Madrid' end
    ),
    source = coalesce(version.snapshot ->> 'source', 'manual'),
    google_place_id = version.snapshot ->> 'google_place_id',
    created_at = (version.snapshot ->> 'created_at')::timestamptz,
    updated_at = now()
  from public.lead_versions as version
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and version.existed
    and lead.user_id = v_user_id
    and lead.id = version.lead_id;

  insert into public.leads (
    id, user_id, name, instagram, website, website_status, phone, address,
    lat, lng, problem, notes, status, statuses, contact_date, follow_up_date,
    contacted_at, replied_at, last_contact_at, last_outbound_at,
    last_inbound_at, contact_channel, next_action, next_action_at, source,
    google_place_id, created_at, updated_at
  ) overriding system value
  select
    version.lead_id,
    v_user_id,
    version.snapshot ->> 'name',
    version.snapshot ->> 'instagram',
    version.snapshot ->> 'website',
    coalesce(version.snapshot ->> 'website_status', 'sin_revisar'),
    version.snapshot ->> 'phone',
    version.snapshot ->> 'address',
    (version.snapshot ->> 'lat')::double precision,
    (version.snapshot ->> 'lng')::double precision,
    version.snapshot ->> 'problem',
    version.snapshot ->> 'notes',
    coalesce(version.snapshot ->> 'status', 'por_contactar'),
    case
      when jsonb_typeof(version.snapshot -> 'statuses') = 'array'
      then array(select jsonb_array_elements_text(version.snapshot -> 'statuses'))
      else array[coalesce(version.snapshot ->> 'status', 'por_contactar')]
    end,
    (version.snapshot ->> 'contact_date')::date,
    (version.snapshot ->> 'follow_up_date')::date,
    (version.snapshot ->> 'contacted_at')::timestamptz,
    (version.snapshot ->> 'replied_at')::timestamptz,
    (version.snapshot ->> 'last_contact_at')::timestamptz,
    (version.snapshot ->> 'last_outbound_at')::timestamptz,
    (version.snapshot ->> 'last_inbound_at')::timestamptz,
    version.snapshot ->> 'contact_channel',
    coalesce(
      version.snapshot ->> 'next_action',
      case
        when version.snapshot ->> 'status' in ('cliente', 'descartado')
          or coalesce(version.snapshot -> 'statuses', '[]'::jsonb)
            ?| array['cliente', 'descartado']
          then 'sin_accion'
        when version.snapshot ->> 'status' = 'revisar_mas_tarde'
          or coalesce(version.snapshot -> 'statuses', '[]'::jsonb)
            ? 'revisar_mas_tarde' then 'revisar_mas_tarde'
        when version.snapshot ->> 'status' = 'seguimiento'
          or coalesce(version.snapshot -> 'statuses', '[]'::jsonb)
            ? 'seguimiento' then 'hacer_follow_up'
        when version.snapshot ->> 'status' = 'respondio' then 'responder'
        when version.snapshot ->> 'status' = 'interesado' then 'hacer_follow_up'
        when version.snapshot ->> 'status' = 'contactado'
          and version.snapshot ->> 'follow_up_date' is not null
          then 'hacer_follow_up'
        when version.snapshot ->> 'status' = 'contactado'
          then 'esperar_respuesta'
        else 'contactar'
      end
    ),
    coalesce(
      (version.snapshot ->> 'next_action_at')::timestamptz,
      case when version.snapshot ->> 'follow_up_date' is null then null
        else ((version.snapshot ->> 'follow_up_date')::date + time '09:00')
          at time zone 'Europe/Madrid' end
    ),
    coalesce(version.snapshot ->> 'source', 'manual'),
    version.snapshot ->> 'google_place_id',
    (version.snapshot ->> 'created_at')::timestamptz,
    now()
  from public.lead_versions as version
  where version.change_set_id = v_original.id
    and version.user_id = v_user_id
    and version.existed
    and not exists (
      select 1 from public.leads as current_lead
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

  update public.lead_change_sets set restored_at = now()
  where id = v_original.id;

  return v_original.lead_count;
end;
$$;

revoke all on function public.normalize_crm_phone(text) from public;
revoke all on function public.map_crm_status(text, text[]) from public;
revoke all on function public.log_lead_crm_activity() from public;
grant execute on function public.normalize_crm_phone(text) to authenticated;
grant execute on function public.map_crm_status(text, text[]) to authenticated;

commit;

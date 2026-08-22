begin;

create or replace function public.prune_lead_change_history()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.lead_change_sets
  where user_id = v_user_id
    and created_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.prune_expired_lead_change_sets_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.lead_change_sets
  where user_id = new.user_id
    and created_at < now() - interval '30 days';

  return new;
end;
$$;

create trigger prune_expired_lead_change_sets_before_insert
before insert on public.lead_change_sets
for each row
execute function public.prune_expired_lead_change_sets_on_insert();

revoke all on function public.prune_lead_change_history() from public, anon;
revoke all on function public.prune_expired_lead_change_sets_on_insert() from public, anon;
grant execute on function public.prune_lead_change_history() to authenticated;

commit;

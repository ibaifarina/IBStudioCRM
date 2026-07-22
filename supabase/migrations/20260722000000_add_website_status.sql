begin;

alter table public.leads
  add column website_status text not null default 'sin_revisar'
  check (
    website_status in (
      'sin_revisar',
      'tiene_web',
      'no_tiene_web',
      'web_antigua'
    )
  );

create index leads_user_website_status_idx
  on public.leads (user_id, website_status);

commit;

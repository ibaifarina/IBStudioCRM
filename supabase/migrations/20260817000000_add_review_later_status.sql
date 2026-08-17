begin;

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'por_contactar',
      'revisar_mas_tarde',
      'contactado',
      'seguimiento',
      'respondio',
      'cliente',
      'descartado'
    )
  );

commit;

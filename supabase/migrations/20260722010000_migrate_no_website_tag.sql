begin;

update public.leads as lead
set
  website_status = 'no_tiene_web',
  updated_at = now()
from public.lead_tags as lead_tag
join public.tags as tag
  on tag.id = lead_tag.tag_id
  and tag.user_id = lead_tag.user_id
where lead.id = lead_tag.lead_id
  and lead.user_id = lead_tag.user_id
  and lower(btrim(tag.name)) = 'no tiene web';

-- La clave foránea de lead_tags elimina automáticamente las asociaciones.
delete from public.tags
where lower(btrim(name)) = 'no tiene web';

commit;

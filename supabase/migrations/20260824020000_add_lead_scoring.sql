begin;

alter table public.leads
  add column email text,
  add column facebook text,
  add column business_categories text[] not null default '{}'::text[],
  add column rating numeric(3, 2) check (rating is null or rating between 0 and 5),
  add column review_count integer check (review_count is null or review_count >= 0),
  add column last_review_at timestamptz,
  add column photo_count integer check (photo_count is null or photo_count >= 0),
  add column social_links text[] not null default '{}'::text[],
  add column digital_presence_known boolean not null default false,
  add column open_status text,
  add column is_permanently_closed boolean not null default false,
  add column is_chain boolean not null default false,
  add column lead_score smallint not null default 0 check (lead_score between 0 and 100),
  add column lead_grade text not null default 'D' check (lead_grade in ('A', 'B', 'C', 'D')),
  add column score_breakdown jsonb not null default '{}'::jsonb,
  add column score_confidence smallint not null default 0 check (score_confidence between 0 and 100),
  add column score_version smallint not null default 1 check (score_version > 0),
  add column scored_at timestamptz not null default now();

create index leads_user_score_idx
  on public.leads (user_id, lead_score desc, id desc);
create index leads_user_grade_score_idx
  on public.leads (user_id, lead_grade, lead_score desc);

-- One-time v1 backfill. Historical Apify ratings/categories were not persisted by
-- the old importer, so unknown values receive the same neutral points as the TS
-- calculator and lower confidence. Existing tag names are used only as a category
-- fallback; no historical data is fabricated.
with lead_signals as (
  select
    lead.*,
    lower(
      translate(
        concat_ws(' ',
          array_to_string(lead.business_categories, ' '),
          coalesce(string_agg(tag.name, ' '), '')
        ),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )
    ) as category_text,
    lower(coalesce(lead.website, '')) as website_text,
    lower(coalesce(lead.address, '')) as address_text,
    (lead.instagram is not null or lead.facebook is not null
      or cardinality(lead.social_links) > 0) as has_social,
    (lower(coalesce(lead.website, '')) ~
      '(booksy\.|treatwell\.|fresha\.|planity\.|timify\.|setmore\.|calendly\.|simplybook\.)') as has_booking
  from public.leads as lead
  left join public.lead_tags as link on link.lead_id = lead.id
  left join public.tags as tag on tag.id = link.tag_id
  group by lead.id
), classified as (
  select
    lead_signals.*,
    case
      when category_text ~ '(medicina estetica|clinica estetica|depilacion laser|dent|odontolog|fisioter|podolog|reforma|electric|fontaner|climatiz|aire acondicionado|placas solares|piscina|detailing|taller especializado|inmobiliaria|real estate|gestoria|asesoria|abogado|law firm)'
        then 'HIGH_TICKET'
      when category_text ~ '(peluquer|hair salon|barber|unas|nail salon|belleza|beauty salon|estetica|tattoo|tatuaje|piercing|veterinar|autoescuela|driving school|crossfit|pilates|gimnasio boutique|boutique gym|fotograf|academy|academia|nutric|psicolog|massage|masaj|osteopat)'
        then 'APPOINTMENT'
      when category_text ~ '(restaurant|cafeter|coffee shop|cafe|bar$|bar |cocktail bar|tienda|retail|comercio|boutique|bakery|panaderia)'
        then 'HIGH_VOLUME'
      else 'GENERAL'
    end as business_profile,
    case
      when category_text ~ '(medicina estetica|clinica estetica|depilacion laser|dent|odontolog|fisioter|podolog|reforma|electric|fontaner|climatiz|aire acondicionado|placas solares|piscina|detailing|taller especializado|inmobiliaria|real estate|gestoria|asesoria|abogado|law firm)' then 20
      when category_text ~ '(peluquer|hair salon|barber|unas|nail salon|belleza|beauty salon|estetica|tattoo|tatuaje|piercing|veterinar|autoescuela|driving school|crossfit|pilates|gimnasio boutique|boutique gym|fotograf|academy|academia|nutric|psicolog|massage|masaj|osteopat)' then 15
      when category_text ~ '(restaurant|cafeter|coffee shop|cafe|bar$|bar |cocktail bar|tienda|retail|comercio|boutique|bakery|panaderia)' then 8
      else 10
    end as sector_points,
    case
      when category_text = '' then 'UNKNOWN'
      when category_text ~ '(medicina estetica|clinica estetica|depilacion laser|dent|odontolog|fisioter|podolog|reforma|electric|fontaner|climatiz|aire acondicionado|placas solares|piscina|detailing|taller especializado|inmobiliaria|real estate|gestoria|asesoria|abogado|law firm)' then 'A'
      when category_text ~ '(peluquer|hair salon|barber|unas|nail salon|belleza|beauty salon|estetica|tattoo|tatuaje|piercing|veterinar|autoescuela|driving school|crossfit|pilates|gimnasio boutique|boutique gym|fotograf|academy|academia|nutric|psicolog|massage|masaj|osteopat)' then 'B'
      when category_text ~ '(restaurant|cafeter|coffee shop|cafe|bar$|bar |cocktail bar|tienda|retail|comercio|boutique|bakery|panaderia)' then 'C'
      else 'UNKNOWN'
    end as category_tier,
    case
      when website_status = 'web_antigua' then 15
      when website_status = 'tiene_web' then 5
      when website_text ~ '(booksy\.|treatwell\.|fresha\.|planity\.|timify\.|setmore\.|calendly\.|simplybook\.|instagram\.|facebook\.|fb\.|linktr\.|doctoralia\.|wa\.me|whatsapp\.)' then 23
      when website_status = 'no_tiene_web' then 25
      when website_text <> '' then 5
      else 12
    end as web_points,
    case
      when website_text = '' then 'NONE'
      when website_text ~ '(booksy\.|treatwell\.|fresha\.|planity\.|timify\.|setmore\.|calendly\.|simplybook\.)' then 'BOOKING_PLATFORM'
      when website_text ~ '(instagram\.|facebook\.|fb\.|wa\.me|whatsapp\.)' then 'SOCIAL'
      when website_text ~ '(linktr\.|doctoralia\.|google\.|tripadvisor\.|yelp\.|paginasamarillas\.)' then 'DIRECTORY'
      else 'OWN_WEBSITE'
    end as website_classification,
    case
      when address_text like '%terrassa%' or address_text like '%sabadell%' or address_text like '%mataro%' then 5
      when address_text ~ '(granollers|rubi|cerdanyola|mollet|sant cugat)' then 4
      when address_text ~ '(badalona|sitges)' then 3
      else 2
    end as location_points,
    case
      when address_text like '%terrassa%' then 'Terrassa'
      when address_text like '%sabadell%' then 'Sabadell'
      when address_text like '%mataro%' then 'Mataró'
      when address_text like '%granollers%' then 'Granollers'
      when address_text like '%rubi%' then 'Rubí'
      when address_text like '%cerdanyola%' then 'Cerdanyola'
      when address_text like '%mollet%' then 'Mollet'
      when address_text like '%sant cugat%' then 'Sant Cugat'
      when address_text like '%badalona%' then 'Badalona'
      when address_text like '%sitges%' then 'Sitges'
      when address_text like '%barcelona%' then 'Barcelona'
      else 'Otra zona'
    end as location_name
  from lead_signals
), components as (
  select
    classified.*,
    case
      when review_count is null then 7
      when business_profile = 'HIGH_TICKET' then case when review_count >= 400 then 11 when review_count >= 150 then 14 when review_count >= 50 then 15 when review_count >= 20 then 12 when review_count >= 10 then 8 when review_count >= 5 then 4 else 0 end
      when business_profile = 'APPOINTMENT' then case when review_count >= 400 then 11 when review_count >= 150 then 14 when review_count >= 50 then 15 when review_count >= 20 then 11 when review_count >= 10 then 7 when review_count >= 5 then 3 else 0 end
      when business_profile = 'HIGH_VOLUME' then case when review_count >= 500 then 13 when review_count >= 150 then 15 when review_count >= 50 then 10 when review_count >= 20 then 6 when review_count >= 10 then 3 else 0 end
      else case when review_count >= 400 then 12 when review_count >= 150 then 14 when review_count >= 50 then 15 when review_count >= 20 then 10 when review_count >= 10 then 6 when review_count >= 5 then 3 else 0 end
    end as review_points,
    case when rating is null then 3 when rating < 4 then 0 when rating < 4.2 then 2 when rating < 4.5 then 4 when rating < 4.7 then 6 else 7 end as rating_points,
    case when last_review_at is null then 1 when last_review_at >= now() - interval '30 days' then 3 when last_review_at >= now() - interval '90 days' then 2 when last_review_at >= now() - interval '365 days' then 1 else 0 end as recency_points,
    least(15,
      case when instagram is not null then 6 when facebook is not null then 3 else 0 end
      + case when has_booking then 5 else 0 end
      + case when website_text ~ '(linktr\.|doctoralia\.|google\.|tripadvisor\.|yelp\.|paginasamarillas\.)' then 2 else 0 end
      + case when photo_count >= 10 then 2 when photo_count >= 3 then 1 else 0 end
    ) as digital_points,
    least(10,
      case when phone is not null then 7 else 0 end
      + case when has_social then 2 else 0 end
      + case when email is not null then 1 else 0 end
    ) as contact_points,
    case when review_count is not null and review_count < 10 and not has_social and not has_booking then 10 else 0 end
      + case when rating is not null and rating < 4 then 7 else 0 end
      + case when phone is null and email is null and not has_social then 8 else 0 end
      + case when is_chain then 20 else 0 end as penalty_points,
    (case when review_count is not null then 14 else 0 end)
      + (case when rating is not null then 14 else 0 end)
      + (case when category_text <> '' then 13 else 0 end)
      + (case when website_text <> '' or website_status <> 'sin_revisar' then 13 else 0 end)
      + (case when digital_presence_known or source in ('apify', 'google_maps') or has_social then 10 else 0 end)
      + (case when digital_presence_known or source in ('apify', 'google_maps') or has_booking then 8 else 0 end)
      + (case when phone is not null or email is not null or has_social then 12 else 0 end)
      + (case when address is not null then 8 else 0 end)
      + (case when last_review_at is not null then 8 else 0 end) as confidence_points
  from classified
), totals as (
  select
    components.*,
    review_points + rating_points + recency_points as traction_points,
    review_points + rating_points + recency_points + web_points + digital_points
      + sector_points + contact_points + location_points - penalty_points as raw_score
  from components
), final as (
  select
    totals.*,
    case when is_permanently_closed then 0 else greatest(0, least(100, raw_score))::integer end as final_score
  from totals
)
update public.leads as lead
set
  lead_score = final.final_score,
  lead_grade = case when final.final_score >= 80 then 'A' when final.final_score >= 65 then 'B' when final.final_score >= 50 then 'C' else 'D' end,
  score_confidence = greatest(0, least(100, final.confidence_points)),
  score_version = 1,
  scored_at = now(),
  score_breakdown = jsonb_build_object(
    'traction', jsonb_build_object('score', final.traction_points, 'reviews', final.review_points, 'rating', final.rating_points, 'recency', final.recency_points),
    'webOpportunity', final.web_points,
    'digitalMaturity', final.digital_points,
    'sectorFit', final.sector_points,
    'contactability', final.contact_points,
    'locationFit', final.location_points,
    'penalties', case when final.is_permanently_closed then final.raw_score + final.penalty_points else final.penalty_points end,
    'websiteClassification', final.website_classification,
    'businessProfile', final.business_profile,
    'categoryTier', final.category_tier,
    'location', final.location_name,
    'reasons', jsonb_build_array(
      case when final.website_status = 'web_antigua' then 'Web antigua con oportunidad de mejora' when final.web_points >= 23 then 'Sin web propia' when final.web_points = 5 then 'Ya tiene web propia' else 'Web todavía sin revisar' end,
      case when final.review_count is null then 'Reseñas sin datos (valor neutral)' else final.review_count::text || ' reseñas' end,
      case when final.rating is null then 'Rating sin datos (valor neutral)' else 'Rating ' || final.rating::text end,
      case when final.category_text = '' then 'Sector sin clasificar' else split_part(final.category_text, ' ', 1) end,
      final.location_name
    ),
    'details', jsonb_build_array(
      jsonb_build_object('label', case when final.website_status = 'web_antigua' then 'Web antigua con oportunidad de mejora' when final.web_points >= 23 then 'Sin web propia' when final.web_points = 5 then 'Ya tiene web propia' else 'Web todavía sin revisar' end, 'points', final.web_points),
      jsonb_build_object('label', case when final.review_count is null then 'Reseñas sin datos (valor neutral)' else final.review_count::text || ' reseñas' end, 'points', final.review_points),
      jsonb_build_object('label', case when final.rating is null then 'Rating sin datos (valor neutral)' else 'Rating ' || final.rating::text end, 'points', final.rating_points),
      jsonb_build_object('label', case when final.category_text = '' then 'Sector sin clasificar' else final.category_text end, 'points', final.sector_points),
      jsonb_build_object('label', final.location_name, 'points', final.location_points),
      jsonb_build_object('label', 'Canales de contacto', 'points', final.contact_points)
    )
  )
from final
where lead.id = final.id;

create or replace function public.apply_lead_scores(p_scores jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  with scores as (
    select *
    from jsonb_to_recordset(coalesce(p_scores, '[]'::jsonb)) as item(
      id bigint,
      lead_score smallint,
      lead_grade text,
      score_breakdown jsonb,
      score_confidence smallint,
      score_version smallint,
      scored_at timestamptz
    )
  )
  update public.leads as lead
  set
    lead_score = scores.lead_score,
    lead_grade = scores.lead_grade,
    score_breakdown = scores.score_breakdown,
    score_confidence = scores.score_confidence,
    score_version = scores.score_version,
    scored_at = scores.scored_at
  from scores
  where lead.id = scores.id
    and lead.user_id = (select auth.uid());

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.apply_lead_scores(jsonb) from public, anon;
grant execute on function public.apply_lead_scores(jsonb) to authenticated;

commit;

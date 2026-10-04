create or replace function public.ingest_website_lead(lead jsonb, key_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing uuid;
  created uuid;
  initial_stage text;
  is_backfill boolean := coalesce((lead->>'backfill')::boolean, false);
  submitted timestamptz := coalesce((lead->>'submitted_at')::timestamptz, now());
  reached timestamptz;
begin
  if not exists (
    select 1 from public.ingest_keys k
    where k.key_hash = ingest_website_lead.key_hash and k.revoked_at is null
  ) then
    raise exception 'invalid ingest key' using errcode = '28000';
  end if;

  if coalesce(lead->>'external_id', '') = '' or coalesce(lead->>'email', '') = '' then
    raise exception 'external_id and email are required' using errcode = '22023';
  end if;

  select l.id into existing
  from public.leads l
  where l.source = coalesce(lead->>'source', 'website-contact')
    and l.external_id = lead->>'external_id';

  if existing is not null then
    return jsonb_build_object('id', existing, 'created', false);
  end if;

  initial_stage := coalesce(
    (select s.id from public.lead_stages s where s.id = lead->>'stage'),
    'new'
  );
  reached := greatest(submitted, coalesce((lead->>'stage_changed_at')::timestamptz, submitted));

  insert into public.leads (
    source, external_id, name, email, phone, organisation, enquiry_type, message,
    source_page, consent, stage, active, stage_changed_at, notes, monday_item_id, submitted_at
  ) values (
    coalesce(lead->>'source', 'website-contact'),
    lead->>'external_id',
    coalesce(nullif(lead->>'name', ''), lead->>'email'),
    lead->>'email',
    nullif(lead->>'phone', ''),
    nullif(lead->>'organisation', ''),
    nullif(lead->>'enquiry_type', ''),
    nullif(lead->>'message', ''),
    nullif(lead->>'source_page', ''),
    coalesce((lead->>'consent')::boolean, false),
    initial_stage,
    coalesce((lead->>'active')::boolean, true),
    reached,
    nullif(lead->>'notes', ''),
    nullif(lead->>'monday_item_id', ''),
    submitted
  )
  returning id into created;

  insert into public.lead_activities (lead_id, kind, body, to_stage, created_by, created_at)
  values (
    created,
    case when is_backfill then 'imported' else 'received' end,
    case when is_backfill then 'Imported from the website' else 'Enquiry received from the website' end,
    initial_stage,
    null,
    case when is_backfill then reached else submitted end
  );

  return jsonb_build_object('id', created, 'created', true);
end;
$$;
revoke all on function public.ingest_website_lead(jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_website_lead(jsonb, text) to service_role;

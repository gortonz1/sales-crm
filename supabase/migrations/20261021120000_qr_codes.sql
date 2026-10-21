create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$'),
  name text not null check (length(trim(name)) between 1 and 80),
  destination text not null check (destination ~* '^https?://[^\s]+$' and length(destination) <= 2000),
  tag_links boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.qr_codes enable row level security;
create index qr_codes_created_by_idx on public.qr_codes (created_by);

create trigger qr_codes_touch
  before update on public.qr_codes
  for each row execute function private.recruitments_touch();

create table public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.qr_codes (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  visitor text,
  device text check (device in ('mobile', 'tablet', 'desktop', 'other')),
  os text,
  country text check (country ~ '^[A-Z]{2}$')
);
alter table public.qr_scans enable row level security;
create index qr_scans_code_idx on public.qr_scans (qr_code_id, scanned_at desc);

create table private.qr_visitor_salt (
  id boolean primary key default true check (id),
  value text not null
);
insert into private.qr_visitor_salt (value)
values (encode(extensions.gen_random_bytes(32), 'hex'));
revoke all on private.qr_visitor_salt from public, anon, authenticated;

create policy "Members read QR codes" on public.qr_codes
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members add QR codes" on public.qr_codes
  for insert to authenticated
  with check ((select private.is_crm_member()) and created_by = (select auth.uid()));
create policy "Members change QR codes" on public.qr_codes
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));
create policy "Members delete QR codes" on public.qr_codes
  for delete to authenticated using ((select private.is_crm_member()));

create policy "Members read QR scans" on public.qr_scans
  for select to authenticated using ((select private.is_crm_member()));

revoke all on public.qr_codes, public.qr_scans from anon, authenticated;
grant select, delete on public.qr_codes to authenticated;
grant insert (slug, name, destination, tag_links) on public.qr_codes to authenticated;
grant update (name, destination, tag_links) on public.qr_codes to authenticated;
grant select on public.qr_scans to authenticated;
grant all on public.qr_codes, public.qr_scans to service_role;

alter table public.leads
  add column qr_code_id uuid references public.qr_codes (id) on delete set null;
create index leads_qr_code_idx on public.leads (qr_code_id) where qr_code_id is not null;
grant update (qr_code_id) on public.leads to authenticated;
grant insert (qr_code_id) on public.leads to authenticated;

insert into public.board_columns (board, field, label, type, position, width, hidden)
select b.board, 'qr_code_id', 'QR code', 'text',
  coalesce((select max(c.position) + 1 from public.board_columns c where c.board = b.board), 1),
  10, true
from (values ('leads'), ('ai-enquiries')) as b(board);

create or replace function public.record_qr_scan(
  code_slug text,
  visitor_ip text default null,
  user_agent text default null,
  device text default null,
  os text default null,
  country text default null,
  counted boolean default true
)
returns table (destination text, slug text, tag_links boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  code public.qr_codes%rowtype;
  visitor_hash text;
begin
  select * into code from public.qr_codes c where c.slug = lower(trim(code_slug));
  if not found then
    return;
  end if;

  if counted then
    if coalesce(visitor_ip, '') <> '' or coalesce(user_agent, '') <> '' then
      visitor_hash := encode(
        extensions.hmac(
          coalesce(visitor_ip, '') || '|' || coalesce(user_agent, ''),
          (select s.value from private.qr_visitor_salt s),
          'sha256'
        ),
        'hex'
      );
    end if;

    if visitor_hash is null or not exists (
      select 1 from public.qr_scans s
      where s.qr_code_id = code.id
        and s.visitor = visitor_hash
        and s.scanned_at > now() - interval '30 seconds'
    ) then
      insert into public.qr_scans (qr_code_id, visitor, device, os, country)
      values (
        code.id,
        visitor_hash,
        case when record_qr_scan.device in ('mobile', 'tablet', 'desktop', 'other')
          then record_qr_scan.device end,
        nullif(left(trim(record_qr_scan.os), 30), ''),
        case when upper(record_qr_scan.country) ~ '^[A-Z]{2}$' and upper(record_qr_scan.country) <> 'XX'
          then upper(record_qr_scan.country) end
      );
    end if;
  end if;

  return query select code.destination, code.slug, code.tag_links;
end;
$$;
revoke all on function public.record_qr_scan(text, text, text, text, text, text, boolean) from public;
grant execute on function public.record_qr_scan(text, text, text, text, text, text, boolean) to anon, authenticated, service_role;

create or replace function public.qr_code_totals()
returns table (
  qr_code_id uuid,
  scans bigint,
  visitors bigint,
  leads bigint,
  last_scan_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    coalesce(s.scans, 0),
    coalesce(s.visitors, 0),
    (select count(*) from public.leads l where l.qr_code_id = c.id),
    s.last_scan_at
  from public.qr_codes c
  left join (
    select
      x.qr_code_id,
      count(*) as scans,
      count(distinct coalesce(x.visitor, x.id::text)) as visitors,
      max(x.scanned_at) as last_scan_at
    from public.qr_scans x
    group by x.qr_code_id
  ) s on s.qr_code_id = c.id;
$$;
revoke all on function public.qr_code_totals() from public, anon;
grant execute on function public.qr_code_totals() to authenticated;

create or replace function public.qr_code_report(code uuid, days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with span as (
    select
      greatest(1, least(days, 366)) as length,
      (now() at time zone 'Europe/London')::date as last_day
  ),
  scans as (
    select s.*, (s.scanned_at at time zone 'Europe/London')::date as day
    from public.qr_scans s
    where s.qr_code_id = code
  )
  select jsonb_build_object(
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day::text,
        'scans', (select count(*) from scans x where x.day = d.day),
        'visitors', (select count(distinct coalesce(x.visitor, x.id::text)) from scans x where x.day = d.day)
      ) order by d.day), '[]'::jsonb)
      from span, lateral (
        select span.last_day - i as day from generate_series(0, span.length - 1) as i
      ) d
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('label', g.label, 'scans', g.scans) order by g.scans desc), '[]'::jsonb)
      from (select coalesce(x.device, 'other') as label, count(*) as scans from scans x group by 1) g
    ),
    'systems', (
      select coalesce(jsonb_agg(jsonb_build_object('label', g.label, 'scans', g.scans) order by g.scans desc), '[]'::jsonb)
      from (select coalesce(x.os, 'Other') as label, count(*) as scans from scans x group by 1) g
    ),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('label', g.label, 'scans', g.scans) order by g.scans desc), '[]'::jsonb)
      from (select x.country as label, count(*) as scans from scans x where x.country is not null group by 1) g
    )
  );
$$;
revoke all on function public.qr_code_report(uuid, integer) from public, anon;
grant execute on function public.qr_code_report(uuid, integer) to authenticated;

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
  qr_id uuid;
  qr_name text;
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
  select c.id, c.name into qr_id, qr_name
  from public.qr_codes c
  where c.slug = lower(coalesce(
    nullif(trim(lead->>'qr'), ''),
    substring(lead->>'source_page' from '[?&]qr=([A-Za-z0-9-]+)'),
    case when lead->>'source_page' ~* '[?&]utm_source=qr([&#]|$)'
      then substring(lead->>'source_page' from '[?&]utm_campaign=([A-Za-z0-9-]+)') end
  ));

  insert into public.leads (
    source, external_id, name, email, phone, organisation, enquiry_type, message,
    source_page, consent, stage, active, stage_changed_at, notes, monday_item_id, submitted_at,
    qr_code_id
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
    submitted,
    qr_id
  )
  returning id into created;

  insert into public.lead_activities (lead_id, kind, body, to_stage, created_by, created_at)
  values (
    created,
    case when is_backfill then 'imported' else 'received' end,
    case when is_backfill then 'Imported from the website' else 'Enquiry received from the website' end
      || coalesce(' after scanning the QR code "' || qr_name || '"', ''),
    initial_stage,
    null,
    case when is_backfill then reached else submitted end
  );

  return jsonb_build_object('id', created, 'created', true);
end;
$$;
revoke all on function public.ingest_website_lead(jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_website_lead(jsonb, text) to service_role;

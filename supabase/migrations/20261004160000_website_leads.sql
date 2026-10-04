create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.crm_members (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.crm_members enable row level security;
revoke all on public.crm_members from anon, authenticated;

insert into public.crm_members (email) values ('ash@themarketingtrainer.co.uk');

create or replace function private.is_crm_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.crm_members m on m.email = lower(u.email)
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.is_crm_member() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_crm_member() to authenticated;

create table public.lead_stages (
  id text primary key,
  label text not null,
  position int not null unique,
  in_pipeline boolean not null default true
);
alter table public.lead_stages enable row level security;

insert into public.lead_stages (id, label, position, in_pipeline) values
  ('new', 'New — not reviewed', 0, false),
  ('genuine-lead', 'Genuine Employer Lead', 1, true),
  ('contacted', 'Contacted', 2, true),
  ('meeting-booked', 'Meeting Booked', 3, true),
  ('recruiting', 'Recruiting Apprentice', 4, true),
  ('started', 'Apprentice Started', 5, true),
  ('not-a-lead', 'Not a lead', 6, false);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  name text not null,
  email text not null,
  phone text,
  organisation text,
  enquiry_type text,
  message text,
  source_page text,
  consent boolean not null default false,
  stage text not null default 'new' references public.lead_stages (id) on update cascade,
  active boolean not null default true,
  stage_changed_at timestamptz not null default now(),
  notes text,
  monday_item_id text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.leads enable row level security;
create index leads_stage_idx on public.leads (stage);
create index leads_submitted_at_idx on public.leads (submitted_at desc);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null check (kind in ('received', 'imported', 'stage', 'active', 'note')),
  body text,
  from_stage text,
  to_stage text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.lead_activities enable row level security;
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_activities_created_by_idx on public.lead_activities (created_by);

create table public.ingest_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.ingest_keys enable row level security;
revoke all on public.ingest_keys from anon, authenticated;

create policy "Members read stages" on public.lead_stages
  for select to authenticated using ((select private.is_crm_member()));

create policy "Members read leads" on public.leads
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members update leads" on public.leads
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));

create policy "Members read activity" on public.lead_activities
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members add notes" on public.lead_activities
  for insert to authenticated
  with check ((select private.is_crm_member()) and kind = 'note' and created_by = (select auth.uid()));

revoke all on public.leads, public.lead_activities, public.lead_stages from anon, authenticated;
grant select on public.lead_stages, public.leads, public.lead_activities to authenticated;
grant update (name, email, phone, organisation, stage, active, notes) on public.leads to authenticated;
grant insert (lead_id, kind, body) on public.lead_activities to authenticated;
grant all on public.lead_stages, public.leads, public.lead_activities, public.ingest_keys, public.crm_members to service_role;

create or replace function private.leads_track_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    insert into public.lead_activities (lead_id, kind, from_stage, to_stage)
    values (new.id, 'stage', old.stage, new.stage);
  end if;
  if new.active is distinct from old.active then
    insert into public.lead_activities (lead_id, kind, body)
    values (new.id, 'active', case when new.active then 'Marked active' else 'Marked no longer active' end);
  end if;
  return new;
end;
$$;
revoke all on function private.leads_track_changes() from public, anon, authenticated;

create trigger leads_track_changes
  before update on public.leads
  for each row execute function private.leads_track_changes();

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
    update public.leads l set
      name = coalesce(nullif(lead->>'name', ''), l.name),
      email = lead->>'email',
      phone = nullif(lead->>'phone', ''),
      organisation = nullif(lead->>'organisation', ''),
      enquiry_type = nullif(lead->>'enquiry_type', ''),
      message = nullif(lead->>'message', ''),
      source_page = coalesce(nullif(lead->>'source_page', ''), l.source_page),
      consent = coalesce((lead->>'consent')::boolean, l.consent),
      monday_item_id = coalesce(nullif(lead->>'monday_item_id', ''), l.monday_item_id)
    where l.id = existing;
    return jsonb_build_object('id', existing, 'created', false);
  end if;

  initial_stage := coalesce(
    (select s.id from public.lead_stages s where s.id = lead->>'stage'),
    'new'
  );

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
    coalesce((lead->>'stage_changed_at')::timestamptz, (lead->>'submitted_at')::timestamptz, now()),
    nullif(lead->>'notes', ''),
    nullif(lead->>'monday_item_id', ''),
    coalesce((lead->>'submitted_at')::timestamptz, now())
  )
  returning id into created;

  insert into public.lead_activities (lead_id, kind, body, to_stage, created_by, created_at)
  values (
    created,
    case when coalesce((lead->>'backfill')::boolean, false) then 'imported' else 'received' end,
    case when coalesce((lead->>'backfill')::boolean, false)
      then 'Imported from the website'
      else 'Enquiry received from the website' end,
    initial_stage,
    null,
    coalesce((lead->>'submitted_at')::timestamptz, now())
  );

  return jsonb_build_object('id', created, 'created', true);
end;
$$;
revoke all on function public.ingest_website_lead(jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_website_lead(jsonb, text) to service_role;

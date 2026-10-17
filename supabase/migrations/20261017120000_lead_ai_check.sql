alter table public.leads
  add column ai_check text check (ai_check in (
    'queued', 'running', 'failed', 'genuine', 'not-genuine', 'unsure'
  )),
  add column ai_reason text,
  add column ai_checked_at timestamptz,
  add column ai_started_at timestamptz,
  add column ai_attempts integer not null default 0;

create index leads_ai_check_open_idx on public.leads (created_at)
  where ai_check in ('queued', 'running');

alter table public.lead_activities drop constraint lead_activities_kind_check;
alter table public.lead_activities add constraint lead_activities_kind_check
  check (kind in ('received', 'imported', 'stage', 'active', 'note', 'check'));

create or replace function private.leads_queue_ai_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source <> 'email' and new.stage = 'new' then
    new.ai_check := 'queued';
  end if;
  return new;
end;
$$;
revoke all on function private.leads_queue_ai_check() from public, anon, authenticated;

create trigger leads_queue_ai_check
  before insert on public.leads
  for each row execute function private.leads_queue_ai_check();

create or replace function public.queue_lead_checks(lead_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  if not (select private.is_crm_member()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.leads l
  set ai_check = 'queued',
      ai_attempts = 0,
      ai_started_at = null
  where l.id = any (lead_ids)
    and l.ai_check is distinct from 'running';
  get diagnostics queued = row_count;
  return queued;
end;
$$;
revoke all on function public.queue_lead_checks(uuid[]) from public, anon;
grant execute on function public.queue_lead_checks(uuid[]) to authenticated;

create or replace function public.claim_lead_checks(max_checks integer default 3)
returns table (
  id uuid,
  name text,
  email text,
  organisation text,
  enquiry_type text,
  message text,
  source_page text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_run_automations()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.leads l
  set ai_check = 'failed',
      ai_reason = 'Gave up after 3 attempts.',
      ai_checked_at = now()
  where l.ai_check = 'running'
    and l.ai_started_at < now() - interval '10 minutes'
    and l.ai_attempts >= 3;

  return query
  update public.leads l
  set ai_check = 'running',
      ai_attempts = l.ai_attempts + 1,
      ai_started_at = now()
  where l.id in (
    select q.id
    from public.leads q
    where (
        q.ai_check = 'queued'
        or (q.ai_check = 'running' and q.ai_started_at < now() - interval '10 minutes')
      )
      and q.ai_attempts < 3
    order by q.created_at
    limit greatest(1, least(coalesce(max_checks, 3), 10))
    for update skip locked
  )
  returning l.id, l.name, l.email, l.organisation, l.enquiry_type, l.message, l.source_page;
end;
$$;
revoke all on function public.claim_lead_checks(integer) from public, anon;
grant execute on function public.claim_lead_checks(integer) to authenticated, service_role;

create or replace function public.finish_lead_check(
  lead_id uuid,
  verdict text default null,
  reason text default null,
  retry boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked public.leads%rowtype;
  moved boolean := false;
  summary text;
begin
  if not (select private.can_run_automations()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into checked from public.leads l
  where l.id = finish_lead_check.lead_id and l.ai_check = 'running'
  for update;
  if checked.id is null then
    return;
  end if;

  if verdict is null then
    update public.leads l
    set ai_check = case when retry and l.ai_attempts < 3 then 'queued' else 'failed' end,
        ai_reason = left(reason, 500),
        ai_checked_at = case when retry and l.ai_attempts < 3 then l.ai_checked_at else now() end
    where l.id = checked.id;
    return;
  end if;

  if verdict not in ('genuine', 'not-genuine', 'unsure') then
    raise exception 'unknown verdict' using errcode = '22023';
  end if;

  moved := verdict = 'not-genuine' and checked.stage = 'new';
  update public.leads l
  set ai_check = verdict,
      ai_reason = left(reason, 500),
      ai_checked_at = now(),
      stage = case when moved then 'not-a-lead' else l.stage end
  where l.id = checked.id;

  summary := case verdict
    when 'genuine' then 'Looks genuine.'
    when 'unsure' then 'Unsure, needs a look.'
    when 'not-genuine' then
      case when moved then 'Not a genuine lead, so moved to Not a lead.' else 'Not a genuine lead.' end
  end;
  insert into public.lead_activities (lead_id, kind, body, created_by, created_at)
  values (
    checked.id,
    'check',
    summary || coalesce(' ' || nullif(left(reason, 500), ''), ''),
    null,
    coalesce(checked.ai_started_at, now())
  );
end;
$$;
revoke all on function public.finish_lead_check(uuid, text, text, boolean) from public, anon;
grant execute on function public.finish_lead_check(uuid, text, text, boolean) to authenticated, service_role;

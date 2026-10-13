create table public.automations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  trigger text not null check (trigger in ('file_added')),
  trigger_column_id uuid not null references public.board_columns (id) on delete cascade,
  action text not null check (action in ('ai_extract')),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.automations enable row level security;
create index automations_board_idx on public.automations (board_id, created_at);
create index automations_trigger_column_idx on public.automations (trigger_column_id);
create index automations_created_by_idx on public.automations (created_by);

create policy "Members read automations" on public.automations
  for select to authenticated using ((select private.is_crm_member()));
create policy "Admins add automations" on public.automations
  for insert to authenticated with check ((select private.is_crm_admin()));
create policy "Admins change automations" on public.automations
  for update to authenticated
  using ((select private.is_crm_admin()))
  with check ((select private.is_crm_admin()));
create policy "Admins delete automations" on public.automations
  for delete to authenticated using ((select private.is_crm_admin()));

revoke all on public.automations from anon, authenticated;
grant select, delete on public.automations to authenticated;
grant insert (board_id, name, trigger, trigger_column_id, action, config, enabled) on public.automations to authenticated;
grant update (name, trigger, trigger_column_id, action, config, enabled) on public.automations to authenticated;
grant all on public.automations to service_role;

create or replace function private.automations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  fields text[];
  bad integer;
begin
  if not exists (
    select 1 from public.board_columns c
    where c.id = new.trigger_column_id
      and c.board = 'custom'
      and c.board_id = new.board_id
      and c.type = 'file'
      and c.deleted_at is null
  ) then
    raise exception 'the trigger must be a file column on this board' using errcode = '22023';
  end if;

  if jsonb_typeof(new.config -> 'fields') is distinct from 'array' then
    raise exception 'config.fields must be an array of column ids' using errcode = '22023';
  end if;
  select coalesce(array_agg(value), '{}') into fields
  from jsonb_array_elements_text(new.config -> 'fields');
  if array_length(fields, 1) is null then
    raise exception 'pick at least one column to fill' using errcode = '22023';
  end if;
  select count(*) into bad
  from unnest(fields) as f
  where f = new.trigger_column_id::text
    or not exists (
      select 1 from public.board_columns c
      where c.id::text = f
        and c.board_id = new.board_id
        and c.type <> 'file'
        and c.deleted_at is null
    );
  if bad > 0 then
    raise exception 'config.fields must name non-file columns on this board' using errcode = '22023';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.automations_guard() from public, anon, authenticated;

create trigger automations_guard
  before insert or update on public.automations
  for each row execute function private.automations_guard();

create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  item_id uuid not null references public.board_items (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  result jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
alter table public.automation_jobs enable row level security;
create index automation_jobs_board_idx on public.automation_jobs (board_id, created_at desc);
create index automation_jobs_item_idx on public.automation_jobs (item_id);
create index automation_jobs_open_idx on public.automation_jobs (board_id, created_at)
  where status in ('queued', 'running');

create policy "Members read automation jobs" on public.automation_jobs
  for select to authenticated using ((select private.is_crm_member()));

revoke all on public.automation_jobs from anon, authenticated;
grant select on public.automation_jobs to authenticated;
grant all on public.automation_jobs to service_role;

alter publication supabase_realtime add table public.automation_jobs;

create or replace function private.queue_file_automations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  spec record;
  col text;
  added jsonb;
begin
  if new.deleted_at is not null then
    return null;
  end if;
  for spec in
    select a.id, a.trigger_column_id::text as column_id
    from public.automations a
    where a.board_id = new.board_id
      and a.enabled
      and a.trigger = 'file_added'
  loop
    col := spec.column_id;
    select coalesce(jsonb_agg(f), '[]'::jsonb) into added
    from jsonb_array_elements(
      case when jsonb_typeof(new.custom -> col) = 'array' then new.custom -> col else '[]'::jsonb end
    ) as f
    where jsonb_typeof(f) = 'object'
      and f ? 'id'
      and not exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(old.custom -> col) = 'array' then old.custom -> col else '[]'::jsonb end
        ) as o
        where o ->> 'id' = f ->> 'id'
      );
    if jsonb_array_length(added) > 0 then
      insert into public.automation_jobs (automation_id, board_id, item_id, payload)
      values (spec.id, new.board_id, new.id, jsonb_build_object('files', added));
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.queue_file_automations() from public, anon, authenticated;

create trigger board_items_queue_automations
  after update of custom on public.board_items
  for each row
  when (old.custom is distinct from new.custom)
  execute function private.queue_file_automations();

create or replace function private.can_run_automations()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_crm_member()) or (select auth.role()) = 'service_role';
$$;
revoke all on function private.can_run_automations() from public, anon;
grant execute on function private.can_run_automations() to authenticated, service_role;

create or replace function public.claim_automation_jobs(board uuid default null, max_jobs integer default 3)
returns setof public.automation_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_run_automations()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.automation_jobs
  set status = 'failed',
      error = 'Gave up after 3 attempts.',
      finished_at = now()
  where status = 'running'
    and started_at < now() - interval '10 minutes'
    and attempts >= 3
    and (board is null or board_id = board);

  delete from public.automation_jobs
  where finished_at < now() - interval '30 days'
    and (board is null or board_id = board);

  return query
  update public.automation_jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      started_at = now(),
      finished_at = null,
      error = null
  where j.id in (
    select q.id
    from public.automation_jobs q
    where (board is null or q.board_id = board)
      and (
        q.status = 'queued'
        or (q.status = 'running' and q.started_at < now() - interval '10 minutes')
      )
      and q.attempts < 3
    order by q.created_at
    limit greatest(1, least(coalesce(max_jobs, 3), 10))
    for update skip locked
  )
  returning j.*;
end;
$$;
revoke all on function public.claim_automation_jobs(uuid, integer) from public, anon;
grant execute on function public.claim_automation_jobs(uuid, integer) to authenticated, service_role;

create or replace function public.finish_automation_job(
  job_id uuid,
  ok boolean,
  outcome jsonb default null,
  message text default null,
  retry boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_run_automations()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.automation_jobs
  set status = case
        when ok then 'done'
        when retry and attempts < 3 then 'queued'
        else 'failed'
      end,
      result = outcome,
      error = case when ok then null else left(message, 2000) end,
      finished_at = case when (not ok) and retry and attempts < 3 then null else now() end
  where id = job_id
    and status = 'running';
end;
$$;
revoke all on function public.finish_automation_job(uuid, boolean, jsonb, text, boolean) from public, anon;
grant execute on function public.finish_automation_job(uuid, boolean, jsonb, text, boolean) to authenticated, service_role;

create or replace function public.requeue_automation_job(job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_crm_member()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.automation_jobs
  set status = 'queued',
      attempts = 0,
      error = null,
      result = null,
      started_at = null,
      finished_at = null
  where id = job_id
    and status = 'failed';
end;
$$;
revoke all on function public.requeue_automation_job(uuid) from public, anon;
grant execute on function public.requeue_automation_job(uuid) to authenticated;

create or replace function public.queue_automation(automation_id uuid, item_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  spec public.automations%rowtype;
  col text;
  overwrite boolean;
  fields text[];
  inserted integer;
begin
  if not (select private.is_crm_member()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into spec from public.automations a where a.id = automation_id;
  if spec.id is null then
    raise exception 'unknown automation' using errcode = '22023';
  end if;
  col := spec.trigger_column_id::text;
  overwrite := coalesce((spec.config ->> 'overwrite')::boolean, false);
  select coalesce(array_agg(value), '{}') into fields
  from jsonb_array_elements_text(spec.config -> 'fields');

  insert into public.automation_jobs (automation_id, board_id, item_id, payload)
  select spec.id, i.board_id, i.id, jsonb_build_object('files', jsonb_build_array(latest.f), 'manual', true)
  from public.board_items i
  cross join lateral (
    select t.f
    from jsonb_array_elements(
      case when jsonb_typeof(i.custom -> col) = 'array' then i.custom -> col else '[]'::jsonb end
    ) with ordinality as t(f, n)
    where jsonb_typeof(t.f) = 'object' and t.f ? 'id'
    order by t.n desc
    limit 1
  ) as latest
  where i.board_id = spec.board_id
    and i.deleted_at is null
    and (item_ids is null or i.id = any (item_ids))
    and (overwrite or exists (select 1 from unnest(fields) as f where not (i.custom ? f)))
    and not exists (
      select 1 from public.automation_jobs j
      where j.automation_id = spec.id
        and j.item_id = i.id
        and j.status in ('queued', 'running')
    );
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.queue_automation(uuid, uuid[]) from public, anon;
grant execute on function public.queue_automation(uuid, uuid[]) to authenticated;

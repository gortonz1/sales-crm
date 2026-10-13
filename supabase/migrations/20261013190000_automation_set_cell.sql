alter table public.automations drop constraint automations_action_check;
alter table public.automations add constraint automations_action_check
  check (action in ('ai_extract', 'send_email', 'send_sms', 'set_cell'));

create or replace function private.automations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  trigger_type text;
  fields text[];
  bad integer;
  recipient jsonb;
  wanted_type text;
  target_type text;
  target_options jsonb;
  mode text;
  value_type text;
begin
  if new.trigger = 'item_created' then
    if new.trigger_column_id is not null then
      raise exception 'an item-created trigger has no column' using errcode = '22023';
    end if;
  else
    if new.trigger_column_id is null then
      raise exception 'pick the column that starts the automation' using errcode = '22023';
    end if;
    select c.type into trigger_type
    from public.board_columns c
    where c.id = new.trigger_column_id
      and c.board = 'custom'
      and c.board_id = new.board_id
      and c.deleted_at is null;
    if trigger_type is null then
      raise exception 'the trigger column must be on this board' using errcode = '22023';
    end if;
    if new.trigger = 'file_added' and trigger_type <> 'file' then
      raise exception 'a file trigger needs a Files column' using errcode = '22023';
    end if;
    if new.trigger = 'status_is' then
      if trigger_type <> 'status' then
        raise exception 'a status trigger needs a Status column' using errcode = '22023';
      end if;
      if new.config ? 'status' and jsonb_typeof(new.config -> 'status') not in ('string', 'null') then
        raise exception 'config.status must be a label value' using errcode = '22023';
      end if;
    end if;
  end if;

  if new.action = 'ai_extract' then
    if new.trigger <> 'file_added' then
      raise exception 'AI extraction runs when a file is added' using errcode = '22023';
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
  elsif new.action in ('send_email', 'send_sms') then
    wanted_type := case when new.action = 'send_email' then 'email' else 'phone' end;
    recipient := new.config -> 'to';
    if jsonb_typeof(recipient) is distinct from 'object' then
      raise exception 'pick who to send to' using errcode = '22023';
    end if;
    if recipient ->> 'kind' = 'column' then
      if not exists (
        select 1 from public.board_columns c
        where c.id::text = recipient ->> 'column_id'
          and c.board_id = new.board_id
          and c.type = wanted_type
          and c.deleted_at is null
      ) then
        raise exception 'the recipient must be a % column on this board',
          case when new.action = 'send_email' then 'Email' else 'Phone' end
          using errcode = '22023';
      end if;
    elsif recipient ->> 'kind' = 'fixed' then
      if coalesce(trim(recipient ->> 'value'), '') = '' then
        raise exception 'enter who to send to' using errcode = '22023';
      end if;
    else
      raise exception 'pick who to send to' using errcode = '22023';
    end if;
    if coalesce(trim(new.config ->> 'body'), '') = '' then
      raise exception 'write the message' using errcode = '22023';
    end if;
    if new.action = 'send_email' and coalesce(trim(new.config ->> 'subject'), '') = '' then
      raise exception 'give the email a subject' using errcode = '22023';
    end if;
  elsif new.action = 'set_cell' then
    select c.type, c.options into target_type, target_options
    from public.board_columns c
    where c.id::text = new.config ->> 'column_id'
      and c.board_id = new.board_id
      and c.type <> 'file'
      and c.deleted_at is null;
    if target_type is null then
      raise exception 'pick a column to set' using errcode = '22023';
    end if;
    if new.config ->> 'column_id' = new.trigger_column_id::text then
      raise exception 'the cell to set must be a different column from the trigger' using errcode = '22023';
    end if;
    mode := coalesce(new.config ->> 'mode', 'value');
    if mode not in ('value', 'today', 'clear') then
      raise exception 'config.mode must be value, today or clear' using errcode = '22023';
    end if;
    if mode = 'today' then
      if target_type <> 'date' then
        raise exception 'only a date column can be set to today' using errcode = '22023';
      end if;
      if new.config ? 'offset_days' and jsonb_typeof(new.config -> 'offset_days') <> 'number' then
        raise exception 'config.offset_days must be a number' using errcode = '22023';
      end if;
    elsif mode = 'value' then
      value_type := jsonb_typeof(new.config -> 'value');
      if value_type is null or value_type = 'null' then
        raise exception 'enter the value to set' using errcode = '22023';
      end if;
      if target_type = 'status' then
        if value_type <> 'string' or not exists (
          select 1 from jsonb_array_elements(coalesce(target_options, '[]'::jsonb)) as o
          where o ->> 'value' = new.config ->> 'value'
        ) then
          raise exception 'pick one of the column''s labels' using errcode = '22023';
        end if;
      elsif target_type = 'checkbox' then
        if value_type <> 'boolean' then
          raise exception 'a checkbox is set to true or false' using errcode = '22023';
        end if;
      elsif target_type = 'number' then
        if value_type <> 'number' then
          raise exception 'enter a number' using errcode = '22023';
        end if;
      elsif target_type = 'date' then
        if value_type <> 'string' or new.config ->> 'value' !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'enter a date as YYYY-MM-DD' using errcode = '22023';
        end if;
      elsif value_type <> 'string' or coalesce(trim(new.config ->> 'value'), '') = '' then
        raise exception 'enter the value to set' using errcode = '22023';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.automation_depth()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('crm.automation_depth', true), '')::integer, 0);
$$;
revoke all on function private.automation_depth() from public, anon, authenticated;

create or replace function private.queue_automations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  spec record;
  col text;
  added jsonb;
  was text;
  now_value text;
  depth integer;
begin
  if new.deleted_at is not null then
    return null;
  end if;
  depth := private.automation_depth() + 1;
  if depth > 5 then
    return null;
  end if;
  for spec in
    select a.id, a.trigger, a.trigger_column_id::text as column_id, a.config
    from public.automations a
    where a.board_id = new.board_id
      and a.enabled
  loop
    if tg_op = 'INSERT' then
      if spec.trigger = 'item_created' then
        insert into public.automation_jobs (automation_id, board_id, item_id, payload)
        values (spec.id, new.board_id, new.id, jsonb_build_object('depth', depth));
      end if;
      continue;
    end if;

    col := spec.column_id;
    if col is null then
      continue;
    end if;

    if spec.trigger = 'file_added' then
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
        values (spec.id, new.board_id, new.id, jsonb_build_object('files', added, 'depth', depth));
      end if;
    elsif spec.trigger = 'status_is' then
      was := old.custom ->> col;
      now_value := new.custom ->> col;
      if now_value is not null
        and now_value is distinct from was
        and (coalesce(spec.config ->> 'status', '') = '' or spec.config ->> 'status' = now_value)
      then
        insert into public.automation_jobs (automation_id, board_id, item_id, payload)
        values (
          spec.id, new.board_id, new.id,
          jsonb_build_object('column_id', col, 'from', was, 'to', now_value, 'depth', depth)
        );
      end if;
    end if;
  end loop;
  return null;
end;
$$;

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
  if spec.action <> 'ai_extract' or spec.trigger <> 'file_added' then
    raise exception 'only AI extraction can be run on existing items' using errcode = '22023';
  end if;
  col := spec.trigger_column_id::text;
  overwrite := coalesce((spec.config ->> 'overwrite')::boolean, false);
  select coalesce(array_agg(value), '{}') into fields
  from jsonb_array_elements_text(spec.config -> 'fields');

  insert into public.automation_jobs (automation_id, board_id, item_id, payload)
  select spec.id, i.board_id, i.id,
    jsonb_build_object('files', jsonb_build_array(latest.f), 'manual', true, 'depth', 1)
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

create or replace function public.automation_set_cell(job_id uuid, column_id uuid, value jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.automation_jobs%rowtype;
  result jsonb;
begin
  if not (select private.can_run_automations()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into job from public.automation_jobs j where j.id = job_id and j.status = 'running';
  if job.id is null then
    raise exception 'the job is not running' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.board_columns c
    where c.id = column_id
      and c.board = 'custom'
      and c.board_id = job.board_id
      and c.field is null
      and c.type <> 'file'
      and c.deleted_at is null
  ) then
    raise exception 'unknown column' using errcode = '22023';
  end if;

  perform set_config(
    'crm.automation_depth',
    coalesce((job.payload ->> 'depth')::integer, 1)::text,
    true
  );

  update public.board_items
  set custom = case
      when value is null or value = 'null'::jsonb then custom - column_id::text
      else jsonb_set(custom, array[column_id::text], value)
    end
  where id = job.item_id
  returning custom into result;

  if result is null then
    raise exception 'row not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
revoke all on function public.automation_set_cell(uuid, uuid, jsonb) from public, anon;
grant execute on function public.automation_set_cell(uuid, uuid, jsonb) to authenticated, service_role;

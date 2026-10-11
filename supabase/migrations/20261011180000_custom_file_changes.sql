create or replace function public.update_custom_files(
  target text,
  row_id uuid,
  column_id uuid,
  add_files jsonb,
  remove_ids text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  board_names text[];
begin
  if jsonb_typeof(add_files) is distinct from 'array' then
    raise exception 'add_files must be an array' using errcode = '22023';
  end if;

  if target = 'board_items' then
    if not exists (
      select 1
      from public.board_columns c
      join public.board_items i on i.board_id = c.board_id
      where c.id = column_id and c.field is null and c.board = 'custom'
        and c.type = 'file' and i.id = row_id
    ) then
      raise exception 'unknown column' using errcode = '22023';
    end if;
  else
    board_names := case target
      when 'leads' then array['leads', 'ai-enquiries']
      when 'recruitments' then array['recruitment']
      when 'course_interests' then array['mock-exam']
    end;
    if board_names is null then
      raise exception 'unknown table %', target using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.board_columns c
      where c.id = column_id and c.field is null and c.type = 'file'
        and c.board = any (board_names)
    ) then
      raise exception 'unknown column' using errcode = '22023';
    end if;
  end if;

  execute format(
    $sql$
    update public.%I set custom = (
      select case
        when jsonb_array_length(merged.files) = 0 then custom - $2
        else jsonb_set(custom, array[$2], merged.files)
      end
      from (
        select coalesce((
          select jsonb_agg(f)
          from jsonb_array_elements(
            case when jsonb_typeof(custom -> $2) = 'array' then custom -> $2 else '[]'::jsonb end
          ) as f
          where not coalesce(f ->> 'id' = any ($4), false)
        ), '[]'::jsonb) || $1 as files
      ) as merged
    )
    where id = $3
    returning custom
    $sql$,
    target
  ) into result using add_files, column_id::text, row_id, coalesce(remove_ids, '{}');

  if result is null then
    raise exception 'row not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
revoke all on function public.update_custom_files(text, uuid, uuid, jsonb, text[]) from public, anon;
grant execute on function public.update_custom_files(text, uuid, uuid, jsonb, text[]) to authenticated;

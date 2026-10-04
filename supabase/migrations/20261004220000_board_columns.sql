create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('leads', 'ai-enquiries', 'mock-exam', 'recruitment')),
  field text,
  label text not null check (length(trim(label)) between 1 and 60),
  type text not null check (type in (
    'text', 'number', 'date', 'status', 'checkbox', 'email', 'phone', 'link'
  )),
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  position integer not null,
  width numeric(5, 2) not null default 9 check (width between 4 and 40),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board, field)
);
alter table public.board_columns enable row level security;
create index board_columns_board_idx on public.board_columns (board, position);

create policy "Members read board columns" on public.board_columns
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members add board columns" on public.board_columns
  for insert to authenticated
  with check ((select private.is_crm_member()) and field is null);
create policy "Members change board columns" on public.board_columns
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));
create policy "Members delete their own columns" on public.board_columns
  for delete to authenticated
  using ((select private.is_crm_member()) and field is null);

revoke all on public.board_columns from anon, authenticated;
grant select, delete on public.board_columns to authenticated;
grant insert (board, label, type, options, position, width) on public.board_columns to authenticated;
grant update (label, type, options, position, width, hidden) on public.board_columns to authenticated;
grant all on public.board_columns to service_role;

create or replace function private.board_columns_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.field is not null and new.type <> old.type then
    raise exception 'built-in columns keep their type' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger board_columns_guard
  before update on public.board_columns
  for each row execute function private.board_columns_guard();

create or replace function private.board_columns_cleanup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.board in ('leads', 'ai-enquiries') then
    update public.leads set custom = custom - old.id::text where custom ? old.id::text;
  elsif old.board = 'recruitment' then
    update public.recruitments set custom = custom - old.id::text where custom ? old.id::text;
  elsif old.board = 'mock-exam' then
    update public.course_interests set custom = custom - old.id::text where custom ? old.id::text;
  end if;
  return old;
end;
$$;

alter table public.leads add column custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object');
alter table public.recruitments add column custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object');
alter table public.course_interests add column custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object');

create or replace function public.set_custom_value(target text, row_id uuid, column_id uuid, value jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  board_names text[];
begin
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
    where c.id = column_id and c.field is null and c.board = any (board_names)
  ) then
    raise exception 'unknown column' using errcode = '22023';
  end if;

  execute format(
    'update public.%I set custom = case when $1 is null or $1 = ''null''::jsonb then custom - $2 else jsonb_set(custom, array[$2], $1) end where id = $3 returning custom',
    target
  ) into result using value, column_id::text, row_id;

  if result is null then
    raise exception 'row not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
revoke all on function public.set_custom_value(text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_custom_value(text, uuid, uuid, jsonb) to authenticated;

grant update (custom) on public.leads to authenticated;
grant update (custom) on public.recruitments to authenticated;
grant update (custom) on public.course_interests to authenticated;

create trigger board_columns_cleanup
  after delete on public.board_columns
  for each row execute function private.board_columns_cleanup();

create or replace function public.reorder_board_columns(board_name text, ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.board_columns c
  set position = o.idx
  from unnest(ids) with ordinality as o(id, idx)
  where c.id = o.id and c.board = board_name;
$$;
revoke all on function public.reorder_board_columns(text, uuid[]) from public, anon;
grant execute on function public.reorder_board_columns(text, uuid[]) to authenticated;

insert into public.board_columns (board, field, label, type, position, width, hidden)
select b.board, f.field, f.label, f.type, f.position, f.width, f.hidden
from (values ('leads'), ('ai-enquiries')) as b(board)
cross join (values
  ('organisation', 'Organisation', 'text', 1, 12, false),
  ('enquiry_type', 'Enquiry', 'status', 2, 9, false),
  ('stage', 'Stage', 'status', 3, 11, false),
  ('submitted_at', 'Received', 'date', 4, 8, false),
  ('stage_changed_at', 'At stage', 'number', 5, 6, false),
  ('phone', 'Phone', 'phone', 6, 9, true),
  ('message', 'Message', 'text', 7, 18, true),
  ('source_page', 'Page', 'link', 8, 12, true)
) as f(field, label, type, position, width, hidden);

insert into public.board_columns (board, field, label, type, position, width) values
  ('mock-exam', 'email', 'Email', 'email', 1, 16),
  ('mock-exam', 'exam', 'Exam', 'text', 2, 14),
  ('mock-exam', 'score_pct', 'Score', 'number', 3, 5),
  ('mock-exam', 'submitted_at', 'Opted in', 'date', 4, 8),
  ('mock-exam', 'status', 'Status', 'status', 5, 10),
  ('mock-exam', 'notes', 'Notes', 'text', 6, 20);

insert into public.board_columns (board, field, label, type, position, width) values
  ('recruitment', 'status', 'Status', 'status', 1, 9.5),
  ('recruitment', 'est_start', 'Est. start', 'status', 2, 8),
  ('recruitment', 'source', 'Source', 'status', 3, 9),
  ('recruitment', 'shortlist_delivery', 'Shortlist delivery', 'date', 4, 9.5),
  ('recruitment', 'shortlist_count', '# in shortlist', 'number', 5, 6.5),
  ('recruitment', 'interviewees', 'Interviewees', 'text', 6, 8),
  ('recruitment', 'interview_date', 'Interview date', 'date', 7, 9.5),
  ('recruitment', 'notes', 'Notes', 'text', 8, 22),
  ('recruitment', 'das', 'DAS', 'status', 9, 8),
  ('recruitment', 'deposit', 'Deposit', 'status', 10, 8),
  ('recruitment', 'contract', 'Contract', 'status', 11, 8),
  ('recruitment', 'signed_up_on', 'Date of sign-up', 'date', 12, 9.5),
  ('recruitment', 'left_status', 'Left', 'status', 13, 8),
  ('recruitment', 'contact', 'Contact', 'text', 14, 14);

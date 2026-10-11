alter table public.crm_members add column is_admin boolean not null default false;
update public.crm_members set is_admin = true where email = 'ash@themarketingtrainer.co.uk';

create or replace function private.is_crm_admin()
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
      and m.is_admin
  );
$$;
revoke all on function private.is_crm_admin() from public, anon;
grant execute on function private.is_crm_admin() to authenticated;

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_crm_admin();
$$;
revoke all on function public.crm_is_admin() from public, anon;
grant execute on function public.crm_is_admin() to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  position integer not null default 0,
  monday_board_id text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.boards enable row level security;
create index boards_position_idx on public.boards (position);
create index boards_created_by_idx on public.boards (created_by);

create policy "Members read boards" on public.boards
  for select to authenticated using ((select private.is_crm_member()));
create policy "Admins add boards" on public.boards
  for insert to authenticated with check ((select private.is_crm_admin()));
create policy "Admins change boards" on public.boards
  for update to authenticated
  using ((select private.is_crm_admin()))
  with check ((select private.is_crm_admin()));
create policy "Admins delete boards" on public.boards
  for delete to authenticated using ((select private.is_crm_admin()));

revoke all on public.boards from anon, authenticated;
grant select, delete on public.boards to authenticated;
grant insert (name, position, monday_board_id) on public.boards to authenticated;
grant update (name, position) on public.boards to authenticated;
grant all on public.boards to service_role;

create trigger boards_touch
  before update on public.boards
  for each row execute function private.touch_updated_at();

create table public.board_groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  color text not null default '#4c8df6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  monday_group_id text,
  created_at timestamptz not null default now(),
  unique (board_id, id)
);
alter table public.board_groups enable row level security;
create index board_groups_board_idx on public.board_groups (board_id, position);

create policy "Members read board groups" on public.board_groups
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members add board groups" on public.board_groups
  for insert to authenticated with check ((select private.is_crm_member()));
create policy "Members change board groups" on public.board_groups
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));
create policy "Members delete board groups" on public.board_groups
  for delete to authenticated using ((select private.is_crm_member()));

revoke all on public.board_groups from anon, authenticated;
grant select, delete on public.board_groups to authenticated;
grant insert (board_id, name, color, position, monday_group_id) on public.board_groups to authenticated;
grant update (name, color, position) on public.board_groups to authenticated;
grant all on public.board_groups to service_role;

create table public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  group_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 500),
  custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object'),
  position integer not null default 0,
  monday_item_id text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (board_id, group_id) references public.board_groups (board_id, id) on delete cascade
);
alter table public.board_items enable row level security;
create index board_items_board_idx on public.board_items (board_id, position);
create index board_items_group_idx on public.board_items (board_id, group_id);
create index board_items_created_by_idx on public.board_items (created_by);

create policy "Members read board items" on public.board_items
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members add board items" on public.board_items
  for insert to authenticated with check ((select private.is_crm_member()));
create policy "Members change board items" on public.board_items
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));
create policy "Members delete board items" on public.board_items
  for delete to authenticated using ((select private.is_crm_member()));

revoke all on public.board_items from anon, authenticated;
grant select, delete on public.board_items to authenticated;
grant insert (board_id, group_id, name, custom, position, monday_item_id) on public.board_items to authenticated;
grant update (group_id, name, custom, position) on public.board_items to authenticated;
grant all on public.board_items to service_role;

create trigger board_items_touch
  before update on public.board_items
  for each row execute function private.touch_updated_at();

alter table public.board_columns add column board_id uuid references public.boards (id) on delete cascade;
alter table public.board_columns drop constraint board_columns_board_check;
alter table public.board_columns add constraint board_columns_board_check check (
  board in ('leads', 'ai-enquiries', 'mock-exam', 'recruitment', 'custom')
  and (board = 'custom') = (board_id is not null)
);
create index board_columns_board_id_idx on public.board_columns (board_id, position);
grant insert (board, board_id, label, type, options, position, width) on public.board_columns to authenticated;

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
  elsif old.board = 'custom' then
    update public.board_items set custom = custom - old.id::text
    where board_id = old.board_id and custom ? old.id::text;
  end if;
  return old;
end;
$$;

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
  if target = 'board_items' then
    if not exists (
      select 1
      from public.board_columns c
      join public.board_items i on i.board_id = c.board_id
      where c.id = column_id and c.field is null and c.board = 'custom' and i.id = row_id
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
      where c.id = column_id and c.field is null and c.board = any (board_names)
    ) then
      raise exception 'unknown column' using errcode = '22023';
    end if;
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

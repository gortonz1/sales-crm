alter table public.boards add column deleted_at timestamptz, add column deleted_by text;
alter table public.board_groups add column deleted_at timestamptz, add column deleted_by text;
alter table public.board_items add column deleted_at timestamptz, add column deleted_by text;
alter table public.board_columns add column deleted_at timestamptz, add column deleted_by text;
alter table public.board_columns add constraint board_columns_bin_check
  check (deleted_at is null or board = 'custom');

create index boards_deleted_idx on public.boards (deleted_at) where deleted_at is not null;
create index board_groups_deleted_idx on public.board_groups (deleted_at) where deleted_at is not null;
create index board_items_deleted_idx on public.board_items (deleted_at) where deleted_at is not null;
create index board_columns_deleted_idx on public.board_columns (deleted_at) where deleted_at is not null;

create or replace function private.stamp_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null then
      new.deleted_by := null;
    else
      new.deleted_at := now();
      new.deleted_by := (select u.email from auth.users u where u.id = (select auth.uid()));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_deleted() from public, anon, authenticated;

create trigger boards_stamp_deleted before update of deleted_at on public.boards
  for each row execute function private.stamp_deleted();
create trigger board_groups_stamp_deleted before update of deleted_at on public.board_groups
  for each row execute function private.stamp_deleted();
create trigger board_items_stamp_deleted before update of deleted_at on public.board_items
  for each row execute function private.stamp_deleted();
create trigger board_columns_stamp_deleted before update of deleted_at on public.board_columns
  for each row execute function private.stamp_deleted();

grant update (deleted_at) on public.boards, public.board_groups, public.board_items, public.board_columns
  to authenticated;

create or replace function private.custom_file_paths(custom jsonb, only_key text default null)
returns setof text
language sql
immutable
set search_path = ''
as $$
  select f ->> 'path'
  from jsonb_each(coalesce(custom, '{}'::jsonb)) as e,
    jsonb_array_elements(
      case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end
    ) as f
  where (only_key is null or e.key = only_key)
    and jsonb_typeof(f) = 'object'
    and f ? 'path';
$$;
revoke all on function private.custom_file_paths(jsonb, text) from public, anon, authenticated;

create or replace function public.purge_bin()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
  item_ids uuid[];
  column_ids uuid[];
  paths text[];
begin
  if not (select private.is_crm_member()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select coalesce(array_agg(i.id), '{}') into item_ids
  from public.board_items i
  where i.deleted_at < cutoff
    or exists (select 1 from public.board_groups g where g.id = i.group_id and g.deleted_at < cutoff)
    or exists (select 1 from public.boards b where b.id = i.board_id and b.deleted_at < cutoff);

  select coalesce(array_agg(c.id), '{}') into column_ids
  from public.board_columns c
  where c.board = 'custom'
    and (c.deleted_at < cutoff
      or exists (select 1 from public.boards b where b.id = c.board_id and b.deleted_at < cutoff));

  select coalesce(array_agg(distinct p), '{}') into paths
  from (
    select private.custom_file_paths(i.custom) as p
    from public.board_items i where i.id = any (item_ids)
    union all
    select private.custom_file_paths(i.custom, c.id::text)
    from public.board_columns c
    join public.board_items i on i.board_id = c.board_id
    where c.id = any (column_ids)
  ) as found
  where p is not null;

  delete from public.boards where deleted_at < cutoff;
  delete from public.board_groups where deleted_at < cutoff;
  delete from public.board_items where id = any (item_ids);
  delete from public.board_columns where id = any (column_ids);
  return paths;
end;
$$;
revoke all on function public.purge_bin() from public, anon;
grant execute on function public.purge_bin() to authenticated;

create or replace function public.delete_forever(kind text, entry_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  paths text[];
begin
  if not (select private.is_crm_admin()) then
    raise exception 'Only admins can delete things forever' using errcode = '42501';
  end if;

  if kind = 'item' then
    select coalesce(array_agg(distinct p), '{}') into paths
    from (select private.custom_file_paths(custom) as p from public.board_items
          where id = entry_id and deleted_at is not null) as found;
    delete from public.board_items where id = entry_id and deleted_at is not null;
  elsif kind = 'group' then
    select coalesce(array_agg(distinct p), '{}') into paths
    from (select private.custom_file_paths(i.custom) as p
          from public.board_items i
          join public.board_groups g on g.id = i.group_id
          where g.id = entry_id and g.deleted_at is not null) as found;
    delete from public.board_groups where id = entry_id and deleted_at is not null;
  elsif kind = 'column' then
    select coalesce(array_agg(distinct p), '{}') into paths
    from (select private.custom_file_paths(i.custom, c.id::text) as p
          from public.board_columns c
          join public.board_items i on i.board_id = c.board_id
          where c.id = entry_id and c.deleted_at is not null) as found;
    delete from public.board_columns where id = entry_id and deleted_at is not null;
  elsif kind = 'board' then
    select coalesce(array_agg(distinct p), '{}') into paths
    from (select private.custom_file_paths(i.custom) as p
          from public.board_items i
          join public.boards b on b.id = i.board_id
          where b.id = entry_id and b.deleted_at is not null) as found;
    delete from public.boards where id = entry_id and deleted_at is not null;
  else
    raise exception 'unknown kind %', kind using errcode = '22023';
  end if;
  return paths;
end;
$$;
revoke all on function public.delete_forever(text, uuid) from public, anon;
grant execute on function public.delete_forever(text, uuid) to authenticated;

create or replace function private.current_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = (select auth.uid());
$$;
revoke all on function private.current_email() from public, anon, authenticated;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_crm_admin()) then
    raise exception 'Only admins can manage the team' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

create or replace function public.crm_team()
returns table (email text, is_admin boolean, added_at timestamptz, signed_up boolean, is_you boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select m.email, m.is_admin, m.added_at,
      exists (
        select 1 from auth.users u
        where lower(u.email) = m.email and u.email_confirmed_at is not null
      ),
      m.email = private.current_email()
    from public.crm_members m
    order by m.is_admin desc, m.email;
end;
$$;
revoke all on function public.crm_team() from public, anon;
grant execute on function public.crm_team() to authenticated;

create or replace function public.crm_team_add(member_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := lower(trim(member_email));
begin
  perform private.require_admin();
  if clean !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if split_part(clean, '@', 2) <> 'themarketingtrainer.co.uk' then
    raise exception 'Only @themarketingtrainer.co.uk addresses can sign in to the CRM'
      using errcode = '22023';
  end if;
  insert into public.crm_members (email) values (clean) on conflict (email) do nothing;
end;
$$;
revoke all on function public.crm_team_add(text) from public, anon;
grant execute on function public.crm_team_add(text) to authenticated;

create or replace function public.crm_team_set_admin(member_email text, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if lower(member_email) = private.current_email() then
    raise exception 'You can''t change your own admin access' using errcode = '42501';
  end if;
  update public.crm_members set is_admin = make_admin where email = lower(member_email);
end;
$$;
revoke all on function public.crm_team_set_admin(text, boolean) from public, anon;
grant execute on function public.crm_team_set_admin(text, boolean) to authenticated;

create or replace function public.crm_team_remove(member_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if lower(member_email) = private.current_email() then
    raise exception 'You can''t remove yourself' using errcode = '42501';
  end if;
  delete from public.crm_members where email = lower(member_email);
end;
$$;
revoke all on function public.crm_team_remove(text) from public, anon;
grant execute on function public.crm_team_remove(text) to authenticated;

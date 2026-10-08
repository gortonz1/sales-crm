create table private.earnings_password (
  id boolean primary key default true check (id),
  hash text not null
);

create table private.earnings_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
create index earnings_sessions_user_idx on private.earnings_sessions (user_id);

create table private.earnings_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index earnings_attempts_user_idx on private.earnings_attempts (user_id, attempted_at);

create table private.earnings_workspace (
  id boolean primary key default true check (id),
  report jsonb not null,
  plan jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid references auth.users (id) on delete set null,
  saved_by_email text
);

alter table private.earnings_password enable row level security;
alter table private.earnings_sessions enable row level security;
alter table private.earnings_attempts enable row level security;
alter table private.earnings_workspace enable row level security;
revoke all on private.earnings_password, private.earnings_sessions,
  private.earnings_attempts, private.earnings_workspace
  from public, anon, authenticated;

create or replace function private.earnings_session_user(session uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id
  from private.earnings_sessions s
  where s.token = session
    and s.user_id = (select auth.uid())
    and s.expires_at > now()
    and (select private.is_crm_member());
$$;
revoke all on function private.earnings_session_user(uuid) from public, anon, authenticated;

create or replace function private.earnings_check(attempt text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select extensions.crypt(attempt, p.hash) = p.hash from private.earnings_password p),
    false
  );
$$;
revoke all on function private.earnings_check(text) from public, anon, authenticated;

create or replace function public.earnings_unlock(attempt text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  token uuid := gen_random_uuid();
  since timestamptz;
begin
  if uid is null or not (select private.is_crm_member()) then
    return null;
  end if;

  select greatest(
    now() - interval '15 minutes',
    coalesce(max(s.expires_at) - interval '12 hours', '-infinity')
  ) into since
  from private.earnings_sessions s
  where s.user_id = uid;

  if (
    select count(*) from private.earnings_attempts a
    where a.user_id = uid and a.attempted_at > since
  ) >= 5 then
    raise exception 'Too many attempts. Try again in 15 minutes.' using errcode = 'P0001';
  end if;

  if not (select private.earnings_check(attempt)) then
    insert into private.earnings_attempts (user_id) values (uid);
    return null;
  end if;

  insert into private.earnings_sessions (token, user_id, expires_at)
  values (token, uid, now() + interval '12 hours');
  return token;
end;
$$;

create or replace function public.earnings_load(session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select private.earnings_session_user(session)) is null then
    return null;
  end if;
  return jsonb_build_object(
    'workspace',
    (
      select jsonb_build_object(
        'report', w.report,
        'plan', w.plan,
        'saved_at', w.saved_at,
        'saved_by', w.saved_by_email
      )
      from private.earnings_workspace w
    )
  );
end;
$$;

create or replace function public.earnings_save(session uuid, report jsonb, plan jsonb)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select private.earnings_session_user(session));
  saved timestamptz := now();
begin
  if uid is null then
    raise exception 'The earnings dashboard is locked.' using errcode = '42501';
  end if;
  if jsonb_typeof(report) <> 'object' or jsonb_typeof(plan) <> 'object' then
    raise exception 'Nothing to save.' using errcode = '22023';
  end if;

  insert into private.earnings_workspace (id, report, plan, saved_at, saved_by, saved_by_email)
  values (true, report, plan, saved, uid, (select u.email from auth.users u where u.id = uid))
  on conflict (id) do update
    set report = excluded.report,
        plan = excluded.plan,
        saved_at = excluded.saved_at,
        saved_by = excluded.saved_by,
        saved_by_email = excluded.saved_by_email;
  return saved;
end;
$$;

create or replace function public.earnings_lock(session uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from private.earnings_sessions
  where user_id = (select auth.uid())
    and (token = session or expires_at < now());
$$;

revoke all on function public.earnings_unlock(text) from public, anon;
revoke all on function public.earnings_load(uuid) from public, anon;
revoke all on function public.earnings_save(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.earnings_lock(uuid) from public, anon;
grant execute on function public.earnings_unlock(text) to authenticated;
grant execute on function public.earnings_load(uuid) to authenticated;
grant execute on function public.earnings_save(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.earnings_lock(uuid) to authenticated;


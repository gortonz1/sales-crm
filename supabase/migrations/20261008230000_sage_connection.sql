create table private.sage_connection (
  id boolean primary key default true check (id),
  tokens text not null,
  business_id text,
  business_name text,
  refresh_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  connected_by_email text,
  updated_at timestamptz not null default now()
);

alter table private.sage_connection enable row level security;
revoke all on private.sage_connection from public, anon, authenticated;

create or replace function public.sage_load(session uuid)
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
    'connection',
    (
      select jsonb_build_object(
        'tokens', c.tokens,
        'business_id', c.business_id,
        'business_name', c.business_name,
        'refresh_expires_at', c.refresh_expires_at,
        'connected_at', c.connected_at,
        'connected_by', c.connected_by_email
      )
      from private.sage_connection c
    )
  );
end;
$$;

create or replace function public.sage_connect(
  session uuid,
  tokens text,
  business_id text,
  business_name text,
  refresh_expires_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select private.earnings_session_user(session));
begin
  if uid is null then
    raise exception 'The earnings dashboard is locked.' using errcode = '42501';
  end if;

  insert into private.sage_connection (
    id, tokens, business_id, business_name, refresh_expires_at,
    connected_at, connected_by_email, updated_at
  )
  values (
    true, tokens, business_id, business_name, refresh_expires_at,
    now(), (select u.email from auth.users u where u.id = uid), now()
  )
  on conflict (id) do update
    set tokens = excluded.tokens,
        business_id = excluded.business_id,
        business_name = excluded.business_name,
        refresh_expires_at = excluded.refresh_expires_at,
        connected_at = excluded.connected_at,
        connected_by_email = excluded.connected_by_email,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.sage_rotate(
  session uuid,
  tokens text,
  refresh_expires_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select private.earnings_session_user(session)) is null then
    raise exception 'The earnings dashboard is locked.' using errcode = '42501';
  end if;

  update private.sage_connection c
  set tokens = sage_rotate.tokens,
      refresh_expires_at = coalesce(sage_rotate.refresh_expires_at, c.refresh_expires_at),
      updated_at = now()
  where c.id;
end;
$$;

create or replace function public.sage_disconnect(session uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select private.earnings_session_user(session)) is null then
    raise exception 'The earnings dashboard is locked.' using errcode = '42501';
  end if;

  delete from private.sage_connection where id;
end;
$$;

revoke all on function public.sage_load(uuid) from public, anon;
revoke all on function public.sage_connect(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.sage_rotate(uuid, text, timestamptz) from public, anon;
revoke all on function public.sage_disconnect(uuid) from public, anon;
grant execute on function public.sage_load(uuid) to authenticated;
grant execute on function public.sage_connect(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.sage_rotate(uuid, text, timestamptz) to authenticated;
grant execute on function public.sage_disconnect(uuid) to authenticated;

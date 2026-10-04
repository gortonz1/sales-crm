create table public.course_interests (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('mock-exam')),
  external_id text not null,
  name text,
  email text not null,
  exam text,
  score_pct numeric(5, 1),
  status text not null default 'new' check (status in (
    'new', 'contacted', 'applying', 'enrolled', 'not-interested'
  )),
  notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.course_interests enable row level security;
create index course_interests_submitted_idx on public.course_interests (submitted_at desc);

create policy "Members read course interests" on public.course_interests
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members update course interests" on public.course_interests
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));

revoke all on public.course_interests from anon, authenticated;
grant select on public.course_interests to authenticated;
grant update (status, notes) on public.course_interests to authenticated;
grant all on public.course_interests to service_role;

create trigger course_interests_touch
  before update on public.course_interests
  for each row execute function private.recruitments_touch();

create or replace function public.ingest_course_interest(item jsonb, key_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing uuid;
  created uuid;
begin
  if not exists (
    select 1 from public.ingest_keys k
    where k.key_hash = ingest_course_interest.key_hash and k.revoked_at is null
  ) then
    raise exception 'invalid ingest key' using errcode = '28000';
  end if;

  if coalesce(item->>'source', '') <> 'mock-exam'
     or coalesce(item->>'external_id', '') = ''
     or coalesce(item->>'email', '') = '' then
    raise exception 'source, external_id and email are required' using errcode = '22023';
  end if;

  select c.id into existing
  from public.course_interests c
  where c.source = item->>'source' and c.external_id = item->>'external_id';

  if existing is not null then
    update public.course_interests c set
      name = coalesce(nullif(item->>'name', ''), c.name),
      email = item->>'email',
      exam = coalesce(nullif(item->>'exam', ''), c.exam),
      score_pct = coalesce((item->>'score_pct')::numeric, c.score_pct)
    where c.id = existing;
    return jsonb_build_object('id', existing, 'created', false);
  end if;

  insert into public.course_interests (source, external_id, name, email, exam, score_pct, submitted_at)
  values (
    item->>'source',
    item->>'external_id',
    nullif(item->>'name', ''),
    item->>'email',
    nullif(item->>'exam', ''),
    (item->>'score_pct')::numeric,
    coalesce((item->>'submitted_at')::timestamptz, now())
  )
  returning id into created;

  return jsonb_build_object('id', created, 'created', true);
end;
$$;
revoke all on function public.ingest_course_interest(jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_course_interest(jsonb, text) to service_role;

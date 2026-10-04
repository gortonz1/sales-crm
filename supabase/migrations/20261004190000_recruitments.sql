create table public.recruitments (
  id uuid primary key default gen_random_uuid(),
  monday_item_id text unique,
  client text not null check (length(trim(client)) > 0),
  contact text,
  status text not null default 'working-on' check (status in (
    'ad-not-live', 'working-on', 'shortlisted', 'interviewing', 'completed',
    'signed-up', 'unsure', 'dead', 'leaver'
  )),
  board_group text not null default 'active' check (board_group in ('active', 'completed', 'limbo', 'dead')),
  est_start_month text check (est_start_month in (
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'unknown'
  )),
  source text check (source in ('website', 'andy', 'mitch', 'repeat', 'referral', 'email-marketing')),
  left_status text check (left_status in ('shaky', 'done', 'withdrawn')),
  shortlist_delivery date,
  shortlist_count int check (shortlist_count >= 0),
  interviewees text,
  interview_date date,
  notes text,
  das text check (das in ('working', 'done', 'stuck')),
  deposit text check (deposit in ('working', 'done', 'stuck')),
  contract text check (contract in ('legacy', 'done', 'stuck')),
  signed_up_on date,
  lead_id uuid references public.leads (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recruitments enable row level security;
create index recruitments_group_idx on public.recruitments (board_group);
create index recruitments_lead_idx on public.recruitments (lead_id);
create index recruitments_created_by_idx on public.recruitments (created_by);

create policy "Members read recruitments" on public.recruitments
  for select to authenticated using ((select private.is_crm_member()));
create policy "Members add recruitments" on public.recruitments
  for insert to authenticated with check ((select private.is_crm_member()));
create policy "Members update recruitments" on public.recruitments
  for update to authenticated
  using ((select private.is_crm_member()))
  with check ((select private.is_crm_member()));

revoke all on public.recruitments from anon, authenticated;
grant select on public.recruitments to authenticated;
grant insert (client, contact, status, board_group, est_start_month, source, left_status,
  shortlist_delivery, shortlist_count, interviewees, interview_date, notes, das, deposit,
  contract, signed_up_on, lead_id) on public.recruitments to authenticated;
grant update (client, contact, status, board_group, est_start_month, source, left_status,
  shortlist_delivery, shortlist_count, interviewees, interview_date, notes, das, deposit,
  contract, signed_up_on, lead_id) on public.recruitments to authenticated;
grant all on public.recruitments to service_role;

create or replace function private.recruitments_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.recruitments_touch() from public, anon, authenticated;

create trigger recruitments_touch
  before update on public.recruitments
  for each row execute function private.recruitments_touch();

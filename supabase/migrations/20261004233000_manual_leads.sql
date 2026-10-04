alter table public.leads
  alter column external_id set default gen_random_uuid()::text;

create policy "Members add email leads" on public.leads
  for insert to authenticated
  with check ((select private.is_crm_member()) and source = 'email');

grant insert (
  source, name, email, phone, organisation, enquiry_type, message,
  stage, submitted_at, stage_changed_at, notes
) on public.leads to authenticated;

create or replace function private.leads_log_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  insert into public.lead_activities (lead_id, kind, body, to_stage, created_by, created_at)
  values (
    new.id,
    'received',
    'Added by hand from an email',
    new.stage,
    (select auth.uid()),
    new.submitted_at
  );
  return new;
end;
$$;
revoke all on function private.leads_log_added() from public, anon, authenticated;

create trigger leads_log_added
  after insert on public.leads
  for each row execute function private.leads_log_added();

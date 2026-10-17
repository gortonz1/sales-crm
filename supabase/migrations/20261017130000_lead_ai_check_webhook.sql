create or replace function private.leads_request_ai_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text;
begin
  if not exists (select 1 from added a where a.ai_check = 'queued') then
    return null;
  end if;
  select s.decrypted_secret into key
  from vault.decrypted_secrets s
  where s.name = 'automation_webhook_secret';
  if key is null then
    return null;
  end if;
  perform net.http_post(
    url := 'https://sales-crm-production-eecb.up.railway.app/api/automations/run',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-automation-key', key),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;
revoke all on function private.leads_request_ai_check() from public, anon, authenticated;

create trigger leads_request_ai_check
  after insert on public.leads
  referencing new table as added
  for each statement
  execute function private.leads_request_ai_check();

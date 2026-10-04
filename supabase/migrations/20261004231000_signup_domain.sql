create or replace function private.enforce_signup_domain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'themarketingtrainer.co.uk' then
    raise exception 'Only @themarketingtrainer.co.uk email addresses can sign up'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_signup_domain() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.enforce_signup_domain() to supabase_auth_admin;

create trigger enforce_signup_domain
  before insert or update of email on auth.users
  for each row execute function private.enforce_signup_domain();

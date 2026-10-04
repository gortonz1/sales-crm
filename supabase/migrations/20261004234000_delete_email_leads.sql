create policy "Members delete email leads" on public.leads
  for delete to authenticated
  using ((select private.is_crm_member()) and source = 'email');

grant delete on public.leads to authenticated;

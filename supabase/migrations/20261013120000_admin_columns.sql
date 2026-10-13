drop policy "Members add board columns" on public.board_columns;
drop policy "Members change board columns" on public.board_columns;
drop policy "Members delete their own columns" on public.board_columns;

create policy "Admins add board columns" on public.board_columns
  for insert to authenticated
  with check ((select private.is_crm_admin()) and field is null);
create policy "Admins change board columns" on public.board_columns
  for update to authenticated
  using ((select private.is_crm_admin()))
  with check ((select private.is_crm_admin()));
create policy "Admins delete board columns" on public.board_columns
  for delete to authenticated
  using ((select private.is_crm_admin()) and field is null);

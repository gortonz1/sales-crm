alter policy "Members add board columns" on public.board_columns
  with check ((select private.is_crm_admin()) and field is null);
alter policy "Members add board columns" on public.board_columns
  rename to "Admins add board columns";

alter policy "Members change board columns" on public.board_columns
  using ((select private.is_crm_admin()))
  with check ((select private.is_crm_admin()));
alter policy "Members change board columns" on public.board_columns
  rename to "Admins change board columns";

alter policy "Members delete their own columns" on public.board_columns
  using ((select private.is_crm_admin()) and field is null);
alter policy "Members delete their own columns" on public.board_columns
  rename to "Admins delete board columns";

alter table public.boards
  add column item_width numeric(5, 2) not null default 16 check (item_width between 6 and 40);
grant update (item_width) on public.boards to authenticated;

alter table public.board_columns drop constraint board_columns_type_check;
alter table public.board_columns add constraint board_columns_type_check check (type in (
  'text', 'number', 'date', 'status', 'checkbox', 'email', 'phone', 'link', 'file', 'recruitment'
));

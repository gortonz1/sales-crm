alter table public.board_columns drop constraint board_columns_type_check;
alter table public.board_columns add constraint board_columns_type_check check (type in (
  'text', 'number', 'date', 'status', 'checkbox', 'email', 'phone', 'link', 'file'
));

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 52428800)
on conflict (id) do nothing;

create policy "Members read CRM files" on storage.objects
  for select to authenticated
  using (bucket_id = 'crm-files' and (select private.is_crm_member()));

create policy "Members upload CRM files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'crm-files'
    and (select private.is_crm_member())
    and exists (
      select 1 from public.board_columns c
      where c.id::text = (storage.foldername(name))[1]
        and c.type = 'file'
    )
  );

create policy "Members delete CRM files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'crm-files' and (select private.is_crm_member()));

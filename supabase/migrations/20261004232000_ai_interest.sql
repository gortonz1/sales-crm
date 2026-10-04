alter table public.leads
  add column interest text check (interest in ('potential', 'solid'));
alter table public.course_interests
  add column interest text check (interest in ('potential', 'solid'));

grant update (interest) on public.leads to authenticated;
grant update (interest) on public.course_interests to authenticated;

with labelled as (
  select
    c.id::text as column_id,
    c.board,
    o.value->>'value' as option_value,
    lower(trim(o.value->>'label')) as label
  from public.board_columns c
  cross join lateral jsonb_array_elements(c.options) as o(value)
  where c.field is null
    and c.type = 'status'
    and c.board in ('ai-enquiries', 'mock-exam')
    and lower(trim(o.value->>'label')) in ('potential', 'solid')
)
update public.leads l
set interest = x.label
from labelled x
where x.board = 'ai-enquiries'
  and l.interest is null
  and l.custom->>x.column_id = x.option_value;

with labelled as (
  select
    c.id::text as column_id,
    c.board,
    o.value->>'value' as option_value,
    lower(trim(o.value->>'label')) as label
  from public.board_columns c
  cross join lateral jsonb_array_elements(c.options) as o(value)
  where c.field is null
    and c.type = 'status'
    and c.board in ('ai-enquiries', 'mock-exam')
    and lower(trim(o.value->>'label')) in ('potential', 'solid')
)
update public.course_interests i
set interest = x.label
from labelled x
where x.board = 'mock-exam'
  and i.interest is null
  and i.custom->>x.column_id = x.option_value;

update public.board_columns
set position = position + 1
where board = 'ai-enquiries' and position >= 4;
insert into public.board_columns (board, field, label, type, position, width)
values ('ai-enquiries', 'interest', 'Interest', 'status', 4, 8);

update public.board_columns
set position = position + 1
where board = 'mock-exam' and position >= 6;
insert into public.board_columns (board, field, label, type, position, width)
values ('mock-exam', 'interest', 'Interest', 'status', 6, 8);

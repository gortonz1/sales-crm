alter table public.recruitments
  add column est_start date check (est_start is null or extract(day from est_start) = 1);

update public.recruitments r
set est_start = make_date(
  extract(year from date_trunc('month', r.created_at))::int
    + case when m.n < extract(month from date_trunc('month', r.created_at))::int then 1 else 0 end,
  m.n,
  1
)
from (values
  ('january', 1), ('february', 2), ('march', 3), ('april', 4), ('may', 5), ('june', 6),
  ('july', 7), ('august', 8), ('september', 9), ('october', 10), ('november', 11), ('december', 12)
) as m(name, n)
where r.est_start_month = m.name
  and r.est_start is null;

grant insert (est_start) on public.recruitments to authenticated;
grant update (est_start) on public.recruitments to authenticated;

create index recruitments_est_start_idx on public.recruitments (est_start);

create table if not exists store_access_assignments (
  access_id text not null,
  store_id text not null,
  created_at timestamptz not null default now(),
  primary key (access_id, store_id)
);

create index if not exists store_access_assignments_store_idx on store_access_assignments(store_id);

alter table store_access_assignments enable row level security;

drop policy if exists "public" on store_access_assignments;
create policy "public" on store_access_assignments for all using (true) with check (true);

insert into store_access_assignments (access_id, store_id)
select id::text, store_id
from store_access_codes
on conflict do nothing;

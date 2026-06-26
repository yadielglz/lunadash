-- Commission Snapshot
-- Run in Supabase SQL Editor if your project was created before this table existed.

create table if not exists commission_snapshots (
  id               text primary key,
  store_id         text not null default 'default',
  snapshot_date    text not null,
  employee_name    text not null default '',
  commission       numeric not null default 0,
  commission_opportunity numeric not null default 0,
  accessories      numeric not null default 0,
  accessory_goal   numeric not null default 0,
  revenue          numeric not null default 0,
  revenue_goal     numeric not null default 0,
  vaf              numeric not null default 0,
  vaf_goal         numeric not null default 0,
  voice_lines      integer not null default 0,
  voice_lines_goal integer not null default 0,
  bts              integer not null default 0,
  bts_goal         integer not null default 0,
  notes            text default '',
  sort_order       integer default 0,
  updated_by       text default '',
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table commission_snapshots add column if not exists commission_opportunity numeric not null default 0;
alter table commission_snapshots add column if not exists accessory_goal numeric not null default 0;
alter table commission_snapshots add column if not exists revenue numeric not null default 0;
alter table commission_snapshots add column if not exists revenue_goal numeric not null default 0;
alter table commission_snapshots add column if not exists vaf_goal numeric not null default 0;
alter table commission_snapshots add column if not exists voice_lines_goal integer not null default 0;
alter table commission_snapshots add column if not exists bts_goal integer not null default 0;

create index if not exists commission_snapshots_store_date_idx
on commission_snapshots(store_id, snapshot_date desc);

create index if not exists commission_snapshots_store_sort_idx
on commission_snapshots(store_id, snapshot_date, sort_order);

alter table commission_snapshots enable row level security;

create policy "public" on commission_snapshots
for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table commission_snapshots;
exception
  when duplicate_object then null;
end $$;

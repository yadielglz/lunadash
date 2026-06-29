-- Store-scoped scheduling blocks
-- Safe to run in the Supabase SQL Editor without resetting existing data.

create table if not exists schedule_blocks (
  id          text primary key,
  store_id    text not null default 'default',
  name        text not null,
  start_time  text not null,
  end_time    text not null,
  note        text default '',
  color       text not null default '#0078d4',
  sort_order  integer default 0,
  counts_toward_coverage boolean not null default true,
  created_at  timestamptz default now()
);

alter table schedule_blocks
  add column if not exists counts_toward_coverage boolean not null default true;

create index if not exists schedule_blocks_store_idx on schedule_blocks(store_id);
create index if not exists schedule_blocks_store_sort_idx on schedule_blocks(store_id, sort_order);

alter table schedule_blocks enable row level security;

drop policy if exists "public" on schedule_blocks;
create policy "public" on schedule_blocks for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table schedule_blocks;
exception
  when duplicate_object then null;
end $$;

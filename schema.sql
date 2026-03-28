-- ============================================================
-- LunaDashboard — Supabase Schema (Multi-Store)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Drop and recreate (safe — no real data exists yet)
drop table if exists announcements cascade;
drop table if exists goals         cascade;
drop table if exists shifts        cascade;
drop table if exists employees     cascade;
drop table if exists app_settings  cascade;

-- Employees
create table employees (
  id          text primary key,
  store_id    text not null default 'default',
  name        text not null,
  role        text not null default 'Associate',
  color       text not null default '#0078d4',
  created_at  timestamptz default now()
);
create index employees_store_idx on employees(store_id);

-- Shifts
create table shifts (
  id          text primary key,
  store_id    text not null default 'default',
  employee_id text references employees(id) on delete cascade,
  date        text not null,
  start_time  text not null,
  end_time    text not null,
  type        text not null default 'Custom',
  note        text default '',
  created_at  timestamptz default now()
);
create index shifts_store_idx on shifts(store_id);
create index shifts_date_idx  on shifts(store_id, date);

-- Goals
create table goals (
  id           text primary key,
  store_id     text not null default 'default',
  title        text not null,
  description  text default '',
  category     text not null,
  target       numeric not null,
  current_val  numeric default 0,
  unit         text default '',
  deadline     text default '',
  color        text default '#0078d4',
  daily_target numeric default 1,
  daily_log    jsonb default '{}',
  milestones   jsonb default '[]',
  created_at   timestamptz default now()
);
create index goals_store_idx on goals(store_id);

-- Announcements
create table announcements (
  id         text primary key,
  store_id   text not null default 'default',
  text       text not null,
  priority   text default 'normal',
  created_at timestamptz default now()
);
create index announcements_store_idx on announcements(store_id);

-- App settings (one row per store)
create table app_settings (
  store_id       text primary key,
  company_name   text default 'Luna Store',
  store_number   text default '',
  slide_interval integer default 8
);

insert into app_settings (store_id) values ('default') on conflict do nothing;

-- ── Row Level Security ─────────────────────────────────────────
alter table employees     enable row level security;
alter table shifts        enable row level security;
alter table goals         enable row level security;
alter table announcements enable row level security;
alter table app_settings  enable row level security;

create policy "public" on employees     for all using (true) with check (true);
create policy "public" on shifts        for all using (true) with check (true);
create policy "public" on goals         for all using (true) with check (true);
create policy "public" on announcements for all using (true) with check (true);
create policy "public" on app_settings  for all using (true) with check (true);

-- ── Realtime ───────────────────────────────────────────────────
alter publication supabase_realtime add table employees;
alter publication supabase_realtime add table shifts;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table announcements;
alter publication supabase_realtime add table app_settings;

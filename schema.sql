-- ============================================================
-- LunaDashboard — Supabase Schema (Multi-Store)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Employees
create table if not exists employees (
  id          text primary key,
  store_id    text not null default 'default',
  name        text not null,
  role        text not null default 'Associate',
  color       text not null default '#0078d4',
  created_at  timestamptz default now()
);
create index if not exists employees_store_idx on employees(store_id);

-- Shifts
create table if not exists shifts (
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
create index if not exists shifts_store_idx on shifts(store_id);
create index if not exists shifts_date_idx  on shifts(store_id, date);

-- Goals
create table if not exists goals (
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
create index if not exists goals_store_idx on goals(store_id);

-- Announcements
create table if not exists announcements (
  id         text primary key,
  store_id   text not null default 'default',
  text       text not null,
  priority   text default 'normal',
  created_at timestamptz default now()
);
create index if not exists announcements_store_idx on announcements(store_id);

-- App settings (one row per store)
create table if not exists app_settings (
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

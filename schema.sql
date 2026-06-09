-- ============================================================
-- LunaDashboard — Supabase Schema (Multi-Store)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Drop and recreate (safe — no real data exists yet)
drop table if exists announcements cascade;
drop table if exists goals         cascade;
drop table if exists employee_sales cascade;
drop table if exists employee_schedule_preferences cascade;
drop table if exists schedule_templates cascade;
drop table if exists schedule_blocks cascade;
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
  sort_order  integer default 0,
  created_at  timestamptz default now()
);
alter table employees add column if not exists sort_order integer default 0;
create index employees_store_idx on employees(store_id);
create index if not exists employees_store_sort_idx on employees(store_id, sort_order);

-- Employee schedule preferences
create table employee_schedule_preferences (
  employee_id        text primary key references employees(id) on delete cascade,
  store_id           text not null default 'default',
  preferred_days     jsonb not null default '[]',
  unavailable_days   jsonb not null default '[]',
  preferred_blocks   jsonb not null default '[]',
  max_hours_per_week numeric,
  notes              text default '',
  updated_at         timestamptz default now()
);
create index employee_schedule_preferences_store_idx on employee_schedule_preferences(store_id);

-- Employee sales and NR estimates
create table employee_sales (
  id                    text primary key,
  store_id              text not null default 'default',
  employee_id           text references employees(id) on delete set null,
  sale_date             text not null,
  category              text not null default 'voice',
  gross_revenue         numeric default 0,
  accessory_revenue     numeric default 0,
  protection_count      integer default 0,
  estimated_net_revenue numeric default 0,
  note                  text default '',
  created_at            timestamptz default now()
);
create index employee_sales_store_idx on employee_sales(store_id);
create index employee_sales_employee_idx on employee_sales(employee_id, sale_date);

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

-- Schedule blocks
create table schedule_blocks (
  id          text primary key,
  store_id    text not null default 'default',
  name        text not null,
  start_time  text not null,
  end_time    text not null,
  note        text default '',
  color       text not null default '#0078d4',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);
create index schedule_blocks_store_idx on schedule_blocks(store_id);
create index schedule_blocks_store_sort_idx on schedule_blocks(store_id, sort_order);

-- Schedule templates
create table schedule_templates (
  id          text primary key,
  store_id    text not null default 'default',
  name        text not null,
  shifts      jsonb not null default '[]',
  created_at  timestamptz default now()
);
create index schedule_templates_store_idx on schedule_templates(store_id);
create index schedule_templates_created_idx on schedule_templates(store_id, created_at desc);

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
create unique index if not exists goals_performance_snapshot_unique_idx
on goals(store_id, description)
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%';

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
  slide_interval integer default 8,
  dealer_nickname text default '',
  dealer_location text default '',
  store_hours jsonb not null default '{
    "sun": {"open": true, "start": "12:00", "end": "18:00"},
    "mon": {"open": true, "start": "10:00", "end": "21:00"},
    "tue": {"open": true, "start": "10:00", "end": "21:00"},
    "wed": {"open": true, "start": "10:00", "end": "21:00"},
    "thu": {"open": true, "start": "10:00", "end": "21:00"},
    "fri": {"open": true, "start": "10:00", "end": "21:00"},
    "sat": {"open": true, "start": "10:00", "end": "21:00"}
  }'::jsonb
);
alter table app_settings add column if not exists dealer_nickname text default '';
alter table app_settings add column if not exists dealer_location text default '';
alter table app_settings add column if not exists store_hours jsonb not null default '{
  "sun": {"open": true, "start": "12:00", "end": "18:00"},
  "mon": {"open": true, "start": "10:00", "end": "21:00"},
  "tue": {"open": true, "start": "10:00", "end": "21:00"},
  "wed": {"open": true, "start": "10:00", "end": "21:00"},
  "thu": {"open": true, "start": "10:00", "end": "21:00"},
  "fri": {"open": true, "start": "10:00", "end": "21:00"},
  "sat": {"open": true, "start": "10:00", "end": "21:00"}
}'::jsonb;
update app_settings
set store_hours = jsonb_set(store_hours, '{sun}', '{"open": true, "start": "12:00", "end": "18:00"}'::jsonb)
where store_hours->'sun' = '{"open": false, "start": "10:00", "end": "21:00"}'::jsonb;

insert into app_settings (store_id) values ('default') on conflict do nothing;

-- ── Row Level Security ─────────────────────────────────────────
alter table employees     enable row level security;
alter table employee_schedule_preferences enable row level security;
alter table employee_sales enable row level security;
alter table shifts        enable row level security;
alter table schedule_blocks enable row level security;
alter table schedule_templates enable row level security;
alter table goals         enable row level security;
alter table announcements enable row level security;
alter table app_settings  enable row level security;

create policy "public" on employees     for all using (true) with check (true);
create policy "public" on employee_schedule_preferences for all using (true) with check (true);
create policy "public" on employee_sales for all using (true) with check (true);
create policy "public" on shifts        for all using (true) with check (true);
create policy "public" on schedule_blocks for all using (true) with check (true);
create policy "public" on schedule_templates for all using (true) with check (true);
create policy "public" on goals         for all using (true) with check (true);
create policy "public" on announcements for all using (true) with check (true);
create policy "public" on app_settings  for all using (true) with check (true);

-- ── Realtime ───────────────────────────────────────────────────
alter publication supabase_realtime add table employees;
alter publication supabase_realtime add table employee_schedule_preferences;
alter publication supabase_realtime add table employee_sales;
alter publication supabase_realtime add table shifts;
alter publication supabase_realtime add table schedule_blocks;
alter publication supabase_realtime add table schedule_templates;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table announcements;
alter publication supabase_realtime add table app_settings;

-- ── Tasks ──────────────────────────────────────────────────────
create table if not exists tasks (
  id             text primary key,
  store_id       text not null default 'default',
  title          text not null,
  category       text not null default 'general',
  sort_order     integer default 0,
  completed_date text,
  created_at     timestamptz default now()
);
create index if not exists tasks_store_idx on tasks(store_id);
alter table tasks enable row level security;
create policy "public" on tasks for all using (true) with check (true);
alter publication supabase_realtime add table tasks;

-- ── Store access codes ─────────────────────────────────────────
create table if not exists store_access_codes (
  id uuid primary key default gen_random_uuid(),
  dealer_code text not null,
  store_id text not null,
  pin_hash text not null,
  role text not null check (role in ('admin', 'district_manager', 'manager', 'employee', 'display')),
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  onboarded_at timestamptz
);
alter table store_access_codes add column if not exists onboarded_at timestamptz;
alter table store_access_codes drop constraint if exists store_access_codes_role_check;
alter table store_access_codes add constraint store_access_codes_role_check
check (role in ('admin', 'district_manager', 'manager', 'employee', 'display'));
create unique index if not exists store_access_codes_dealer_pin_idx
on store_access_codes (dealer_code, pin_hash)
where is_active = true;
alter table store_access_codes enable row level security;
create policy "public" on store_access_codes for all using (true) with check (true);

create table if not exists store_access_assignments (
  access_id text not null,
  store_id text not null,
  created_at timestamptz not null default now(),
  primary key (access_id, store_id)
);
create index if not exists store_access_assignments_store_idx on store_access_assignments(store_id);
alter table store_access_assignments enable row level security;
create policy "public" on store_access_assignments for all using (true) with check (true);

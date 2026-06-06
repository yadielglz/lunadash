create table if not exists employee_schedule_preferences (
  employee_id        text primary key references employees(id) on delete cascade,
  store_id           text not null default 'default',
  preferred_days     jsonb not null default '[]',
  unavailable_days   jsonb not null default '[]',
  preferred_blocks   jsonb not null default '[]',
  max_hours_per_week numeric,
  notes              text default '',
  updated_at         timestamptz default now()
);

create index if not exists employee_schedule_preferences_store_idx
on employee_schedule_preferences(store_id);

create table if not exists employee_sales (
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

create index if not exists employee_sales_store_idx on employee_sales(store_id);
create index if not exists employee_sales_employee_idx on employee_sales(employee_id, sale_date);

alter table employee_schedule_preferences enable row level security;
alter table employee_sales enable row level security;

drop policy if exists "public" on employee_schedule_preferences;
create policy "public" on employee_schedule_preferences for all using (true) with check (true);

drop policy if exists "public" on employee_sales;
create policy "public" on employee_sales for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table employee_schedule_preferences;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table employee_sales;
exception when duplicate_object then
  null;
end $$;

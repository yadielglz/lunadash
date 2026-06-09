create table if not exists schedule_exceptions (
  id text primary key,
  store_id text not null default 'default',
  employee_id text references employees(id) on delete set null,
  exception_date text not null,
  type text not null check (type in ('call_out', 'no_show', 'pto', 'holiday')),
  start_time text,
  end_time text,
  note text default '',
  created_at timestamptz default now()
);

create index if not exists schedule_exceptions_store_date_idx on schedule_exceptions(store_id, exception_date);
create index if not exists schedule_exceptions_employee_idx on schedule_exceptions(employee_id, exception_date);

alter table schedule_exceptions enable row level security;
drop policy if exists "public" on schedule_exceptions;
create policy "public" on schedule_exceptions for all using (true) with check (true);

alter publication supabase_realtime add table schedule_exceptions;

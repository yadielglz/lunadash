create table if not exists nr_tracking_entries (
  id text primary key,
  created_at timestamptz not null default now(),
  sale_date date not null,
  employee_id text,
  employee_name text,
  store_id text not null,
  store_name text,
  source text not null check (source in ('voice-plan-calculator', 'manual')),
  category text not null check (category in ('consumer', '55-plus', 'military-first-responder')),
  plan_id text not null,
  plan_name text not null,
  line_count integer not null check (line_count > 0),
  mrc numeric(12, 2) not null check (mrc >= 0),
  nr numeric(12, 2) not null,
  notes text,
  constraint nr_tracking_supported_plan_lines check (
    (plan_id = 'essentials-savers' and line_count in (1, 2)) or
    (plan_id = 'essentials' and line_count = 3) or
    (plan_id = 'essentials-4x100-offer' and line_count in (4, 5, 6)) or
    (plan_id = 'experience-more' and line_count between 1 and 8) or
    (plan_id = 'better-value' and line_count between 3 and 8) or
    (plan_id = 'experience-beyond' and line_count between 1 and 8) or
    (plan_id = 'essentials-choice-55' and line_count in (1, 2)) or
    (plan_id = 'experience-more-55-plus' and line_count in (1, 2)) or
    (plan_id = 'experience-beyond-55-plus' and line_count in (1, 2)) or
    (plan_id = 'essentials-military' and line_count between 1 and 6) or
    (plan_id = 'experience-more-military-savings' and line_count between 1 and 8) or
    (plan_id = 'experience-beyond-military-savings' and line_count between 1 and 8)
  )
);

create or replace function derive_nr_tracking_revenue()
returns trigger
language plpgsql
as $$
begin
  new.nr := round(new.mrc * 3.8, 2);
  return new;
end;
$$;

drop trigger if exists nr_tracking_derive_revenue on nr_tracking_entries;
create trigger nr_tracking_derive_revenue
before insert or update of mrc on nr_tracking_entries
for each row execute function derive_nr_tracking_revenue();

create index if not exists nr_tracking_store_date_idx
on nr_tracking_entries(store_id, sale_date desc);
create index if not exists nr_tracking_plan_idx
on nr_tracking_entries(store_id, plan_id);
create index if not exists nr_tracking_employee_idx
on nr_tracking_entries(store_id, employee_id);

alter table nr_tracking_entries enable row level security;
create policy "public" on nr_tracking_entries for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table nr_tracking_entries;
exception
  when duplicate_object then null;
end $$;

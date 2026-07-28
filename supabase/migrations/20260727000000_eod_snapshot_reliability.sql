create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists eod_snapshot_runs (
  snapshot_date date primary key,
  status text not null check (status in ('running', 'complete', 'failed')),
  expected_entries integer not null default 0,
  saved_entries integer not null default 0,
  attempt_count integer not null default 0,
  last_error text,
  last_attempt_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table eod_snapshot_runs enable row level security;

drop policy if exists "public read eod snapshot runs" on eod_snapshot_runs;
create policy "public read eod snapshot runs"
on eod_snapshot_runs for select
using (true);

-- Remove goals created when Google returned an HTML document instead of CSV.
delete from goals
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%'
  and store_id <> 'main'
  and store_id !~ '^[A-Z0-9]{4}$';

-- Merge any duplicate valid goals before enforcing one row per store and metric.
drop table if exists perf_snapshot_ranked_tmp;
drop table if exists perf_snapshot_merged_logs_tmp;

create temporary table perf_snapshot_ranked_tmp as
select
  id,
  store_id,
  description,
  row_number() over (
    partition by store_id, description
    order by created_at asc, id
  ) as row_rank
from goals
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%'
  and (store_id = 'main' or store_id ~ '^[A-Z0-9]{4}$');

create temporary table perf_snapshot_merged_logs_tmp as
with log_entries as (
  select
    g.store_id,
    g.description,
    entry.key as day_key,
    max((entry.value)::numeric) as day_value
  from goals g
  cross join lateral jsonb_each_text(coalesce(g.daily_log, '{}'::jsonb)) entry
  where g.category = 'Performance Snapshot'
    and g.description like 'source-snapshot:%'
    and (g.store_id = 'main' or g.store_id ~ '^[A-Z0-9]{4}$')
  group by g.store_id, g.description, entry.key
)
select
  store_id,
  description,
  jsonb_object_agg(day_key, to_jsonb(day_value)) as daily_log
from log_entries
group by store_id, description;

update goals g
set daily_log = coalesce(merged.daily_log, '{}'::jsonb)
from perf_snapshot_ranked_tmp ranked
left join perf_snapshot_merged_logs_tmp merged
  on merged.store_id = ranked.store_id
 and merged.description = ranked.description
where g.id = ranked.id
  and ranked.row_rank = 1;

delete from goals g
using perf_snapshot_ranked_tmp ranked
where g.id = ranked.id
  and ranked.row_rank > 1;

drop table if exists perf_snapshot_ranked_tmp;
drop table if exists perf_snapshot_merged_logs_tmp;

create unique index if not exists goals_performance_snapshot_unique_idx
on goals(store_id, description)
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'lunadash-eod-snapshot') then
    perform cron.unschedule('lunadash-eod-snapshot');
  end if;
  if exists (select 1 from cron.job where jobname = 'lunadash-eod-snapshot-watchdog') then
    perform cron.unschedule('lunadash-eod-snapshot-watchdog');
  end if;
  if exists (select 1 from cron.job where jobname = 'lunadash-eod-snapshot-reliable') then
    perform cron.unschedule('lunadash-eod-snapshot-reliable');
  end if;
end $$;

-- The Edge Function applies the America/New_York 10 PM gate. Running every
-- 15 minutes gives eight independent attempts before midnight without relying
-- on a browser, PWA, kiosk, or desktop app being open.
select cron.schedule(
  'lunadash-eod-snapshot-reliable',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://vzbuboclkpdthztfprgg.supabase.co/functions/v1/snapshot-eod',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

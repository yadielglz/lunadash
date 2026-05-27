drop table if exists perf_snapshot_ranked_tmp;
drop table if exists perf_snapshot_merged_logs_tmp;
drop table if exists perf_snapshot_merged_values_tmp;

create temporary table perf_snapshot_ranked_tmp as
select
  id,
  store_id,
  description,
  row_number() over (
    partition by store_id, description
    order by (
      select count(*)
      from jsonb_object_keys(coalesce(daily_log, '{}'::jsonb))
    ) desc, created_at desc, id
  ) as rn
from goals
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%';

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
  group by g.store_id, g.description, entry.key
)
select
  store_id,
  description,
  jsonb_object_agg(day_key, to_jsonb(day_value)) as daily_log
from log_entries
group by store_id, description;

create temporary table perf_snapshot_merged_values_tmp as
select
  store_id,
  description,
  max(current_val) as current_val,
  max(daily_target) as daily_target
from goals
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%'
group by store_id, description;

update goals g
set
  daily_log = coalesce(ml.daily_log, '{}'::jsonb),
  current_val = mv.current_val,
  daily_target = mv.daily_target
from perf_snapshot_ranked_tmp r
join perf_snapshot_merged_values_tmp mv
  on mv.store_id = r.store_id
 and mv.description = r.description
left join perf_snapshot_merged_logs_tmp ml
  on ml.store_id = r.store_id
 and ml.description = r.description
where g.id = r.id
  and r.rn = 1;

delete from goals g
using perf_snapshot_ranked_tmp r
where g.id = r.id
  and r.rn > 1;

drop table if exists perf_snapshot_ranked_tmp;
drop table if exists perf_snapshot_merged_logs_tmp;
drop table if exists perf_snapshot_merged_values_tmp;

create unique index if not exists goals_performance_snapshot_unique_idx
on goals(store_id, description)
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%';

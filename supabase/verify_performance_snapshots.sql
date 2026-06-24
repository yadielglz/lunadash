with snapshot_dates as (
  select
    store_id,
    entry.key as snapshot_day
  from goals
  cross join lateral jsonb_each(coalesce(daily_log, '{}'::jsonb)) entry
  where category = 'Performance Snapshot'
    and description like 'source-snapshot:%'
    and (store_id = 'main' or store_id ~ '^[A-Z0-9]{4}$')
),
store_ranges as (
  select
    store_id,
    min(snapshot_day::date) as first_day,
    max(snapshot_day::date) as last_day
  from snapshot_dates
  group by store_id
),
expected_days as (
  select
    store_id,
    generate_series(first_day, last_day, interval '1 day')::date as snapshot_day
  from store_ranges
),
missing_days as (
  select
    expected_days.store_id,
    expected_days.snapshot_day
  from expected_days
  left join snapshot_dates
    on snapshot_dates.store_id = expected_days.store_id
   and snapshot_dates.snapshot_day::date = expected_days.snapshot_day
  where snapshot_dates.snapshot_day is null
)
select
  store_ranges.store_id,
  store_ranges.first_day,
  store_ranges.last_day,
  count(distinct snapshot_dates.snapshot_day) as saved_days,
  count(distinct missing_days.snapshot_day) as missing_days,
  coalesce(
    jsonb_agg(distinct missing_days.snapshot_day order by missing_days.snapshot_day)
      filter (where missing_days.snapshot_day is not null),
    '[]'::jsonb
  ) as missing_day_list
from store_ranges
left join snapshot_dates on snapshot_dates.store_id = store_ranges.store_id
left join missing_days on missing_days.store_id = store_ranges.store_id
group by store_ranges.store_id, store_ranges.first_day, store_ranges.last_day
order by case when store_ranges.store_id = 'main' then 0 else 1 end, store_ranges.store_id;

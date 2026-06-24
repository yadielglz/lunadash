create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Runs hourly from Supabase itself. The Edge Function only writes a snapshot
-- after 10 PM America/New_York, so this remains DST-safe without browser uptime.
-- A second watchdog runs between the hourly marks. The Edge Function itself
-- checks America/New_York time, keeping EOD covered without browser uptime.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'lunadash-eod-snapshot') then
    perform cron.unschedule('lunadash-eod-snapshot');
  end if;
  if exists (select 1 from cron.job where jobname = 'lunadash-eod-snapshot-watchdog') then
    perform cron.unschedule('lunadash-eod-snapshot-watchdog');
  end if;
end $$;

select cron.schedule(
  'lunadash-eod-snapshot',
  '5 * * * *',
  $$
    select
      net.http_post(
        url := 'https://vzbuboclkpdthztfprgg.supabase.co/functions/v1/snapshot-eod',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      ) as request_id;
  $$
);

select cron.schedule(
  'lunadash-eod-snapshot-watchdog',
  '35 * * * *',
  $$
    select
      net.http_post(
        url := 'https://vzbuboclkpdthztfprgg.supabase.co/functions/v1/snapshot-eod',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      ) as request_id;
  $$
);

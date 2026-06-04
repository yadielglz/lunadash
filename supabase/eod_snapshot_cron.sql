create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'lunadash-eod-snapshot') then
    perform cron.unschedule('lunadash-eod-snapshot');
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

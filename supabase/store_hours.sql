alter table app_settings
add column if not exists store_hours jsonb not null default '{
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

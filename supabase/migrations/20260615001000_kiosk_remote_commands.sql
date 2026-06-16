-- Remote commands for approved kiosk displays.
alter table kiosk_enrollments
  add column if not exists command text check (command in ('refresh', 'update'));

alter table kiosk_enrollments
  add column if not exists command_issued_at timestamptz;

alter table kiosk_enrollments
  add column if not exists command_ack_at timestamptz;

notify pgrst, 'reload schema';

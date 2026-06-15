-- Kiosk display enrollment sessions for browser/Android TV displays.
create table if not exists kiosk_enrollments (
  id text primary key,
  pairing_code text not null,
  device_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  store_id text,
  display_name text,
  device_label text,
  user_agent text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_seen_at timestamptz,
  command text check (command in ('refresh', 'update')),
  command_issued_at timestamptz,
  command_ack_at timestamptz
);

create index if not exists kiosk_enrollments_status_idx on kiosk_enrollments(status, created_at desc);
create index if not exists kiosk_enrollments_pairing_code_idx on kiosk_enrollments(pairing_code);

alter table kiosk_enrollments enable row level security;

do $$
begin
  create policy "public" on kiosk_enrollments for all using (true) with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table kiosk_enrollments;
exception
  when duplicate_object then null;
end $$;

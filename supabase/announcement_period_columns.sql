alter table public.announcements
  add column if not exists start_at date,
  add column if not exists end_at date;

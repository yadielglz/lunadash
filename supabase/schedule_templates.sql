create table if not exists schedule_templates (
  id          text primary key,
  store_id    text not null default 'default',
  name        text not null,
  shifts      jsonb not null default '[]',
  created_at  timestamptz default now()
);

create index if not exists schedule_templates_store_idx on schedule_templates(store_id);
create index if not exists schedule_templates_created_idx on schedule_templates(store_id, created_at desc);

alter table schedule_templates enable row level security;

drop policy if exists "public" on schedule_templates;
create policy "public" on schedule_templates for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table schedule_templates;
exception when duplicate_object then
  null;
end $$;

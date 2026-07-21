alter table nr_tracking_entries add column if not exists sale_id text;
update nr_tracking_entries set sale_id = id where sale_id is null or sale_id = '';
alter table nr_tracking_entries alter column sale_id set not null;
create index if not exists nr_tracking_sale_id_idx on nr_tracking_entries(sale_id);

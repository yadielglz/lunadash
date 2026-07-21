alter table nr_tracking_entries
  add column if not exists sale_type text not null default 'new-account'
    check (sale_type in ('new-account', 'add-a-line')),
  add column if not exists account_line_count_before integer not null default 0,
  add column if not exists account_line_count_after integer,
  add column if not exists account_mrc_before numeric(12, 2) not null default 0,
  add column if not exists account_mrc_after numeric(12, 2);

update nr_tracking_entries
set account_line_count_after = line_count,
    account_mrc_after = mrc
where account_line_count_after is null or account_mrc_after is null;

alter table nr_tracking_entries
  alter column account_line_count_after set not null,
  alter column account_mrc_after set not null;

alter table nr_tracking_entries drop constraint if exists nr_tracking_supported_plan_lines;
alter table nr_tracking_entries add constraint nr_tracking_supported_account_tier check (
  (plan_id = 'essentials-savers' and account_line_count_after in (1, 2)) or
  (plan_id = 'essentials' and account_line_count_after = 3) or
  (plan_id = 'essentials-4x100-offer' and account_line_count_after in (4, 5, 6)) or
  (plan_id = 'experience-more' and account_line_count_after between 1 and 8) or
  (plan_id = 'better-value' and account_line_count_after between 3 and 8) or
  (plan_id = 'experience-beyond' and account_line_count_after between 1 and 8) or
  (plan_id = 'essentials-choice-55' and account_line_count_after in (1, 2)) or
  (plan_id = 'experience-more-55-plus' and account_line_count_after in (1, 2)) or
  (plan_id = 'experience-beyond-55-plus' and account_line_count_after in (1, 2)) or
  (plan_id = 'essentials-military' and account_line_count_after between 1 and 6) or
  (plan_id = 'experience-more-military-savings' and account_line_count_after between 1 and 8) or
  (plan_id = 'experience-beyond-military-savings' and account_line_count_after between 1 and 8)
);

alter table nr_tracking_entries add constraint nr_tracking_sale_shape check (
  (sale_type = 'new-account' and account_line_count_before = 0 and line_count = account_line_count_after) or
  (sale_type = 'add-a-line' and account_line_count_before > 0 and account_line_count_after > account_line_count_before and line_count = account_line_count_after - account_line_count_before)
);

create or replace function derive_nr_tracking_revenue()
returns trigger
language plpgsql
as $$
begin
  if new.sale_type = 'add-a-line' then
    new.mrc := round(new.account_mrc_after - new.account_mrc_before, 2);
  else
    new.account_line_count_before := 0;
    new.account_mrc_before := 0;
    new.mrc := round(new.account_mrc_after, 2);
  end if;
  if new.mrc < 0 then
    raise exception 'Incremental MRC cannot be negative';
  end if;
  new.nr := round(new.mrc * 3.8, 2);
  return new;
end;
$$;

drop trigger if exists nr_tracking_derive_revenue on nr_tracking_entries;
create trigger nr_tracking_derive_revenue
before insert or update of mrc, sale_type, account_mrc_before, account_mrc_after on nr_tracking_entries
for each row execute function derive_nr_tracking_revenue();

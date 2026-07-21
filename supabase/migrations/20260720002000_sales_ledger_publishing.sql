alter table nr_tracking_entries
  add column if not exists accessory_revenue numeric(12, 2) not null default 0 check (accessory_revenue >= 0),
  add column if not exists dashboard_pushed_at timestamptz,
  add column if not exists dashboard_pushed_by text,
  add column if not exists source_pushed_at timestamptz,
  add column if not exists source_pushed_by text;

alter table nr_tracking_entries drop constraint if exists nr_tracking_sale_shape;
alter table nr_tracking_entries add constraint nr_tracking_sale_shape check (
  (sale_type = 'new-account' and account_line_count_before = 0 and line_count = account_line_count_after) or
  (sale_type = 'add-a-line' and line_count > 0)
);

alter table nr_tracking_entries drop constraint if exists nr_tracking_supported_account_tier;
alter table nr_tracking_entries add constraint nr_tracking_supported_account_tier check (
  sale_type = 'add-a-line' or
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

alter table nr_tracking_entries
  add column if not exists product_category text not null default 'voice'
    check (product_category in ('voice', 'home-internet', 'tablet', 'watch', 'hotspot'));

alter table nr_tracking_entries drop constraint if exists nr_tracking_entries_sale_type_check;
alter table nr_tracking_entries add constraint nr_tracking_entries_sale_type_check
  check (sale_type in ('new-account', 'add-a-line', 'product'));

alter table nr_tracking_entries drop constraint if exists nr_tracking_sale_shape;
alter table nr_tracking_entries add constraint nr_tracking_sale_shape check (
  (sale_type = 'new-account' and product_category = 'voice' and account_line_count_before = 0 and line_count = account_line_count_after) or
  (sale_type = 'add-a-line' and product_category = 'voice' and line_count > 0) or
  (sale_type = 'product' and product_category <> 'voice' and line_count > 0)
);

alter table nr_tracking_entries drop constraint if exists nr_tracking_supported_account_tier;
alter table nr_tracking_entries add constraint nr_tracking_supported_account_tier check (
  product_category <> 'voice' or sale_type = 'add-a-line' or
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

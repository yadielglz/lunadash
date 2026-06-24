delete from goals
where category = 'Performance Snapshot'
  and description like 'source-snapshot:%'
  and store_id <> 'main'
  and store_id !~ '^[A-Z0-9]{4}$';

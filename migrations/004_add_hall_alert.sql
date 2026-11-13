alter table rooms
  add column if not exists hall_alert jsonb;

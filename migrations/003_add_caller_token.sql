alter table rooms
  add column if not exists caller_token text;

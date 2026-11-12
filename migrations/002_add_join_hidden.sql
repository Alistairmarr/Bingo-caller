alter table rooms
  add column if not exists join_hidden boolean not null default false;

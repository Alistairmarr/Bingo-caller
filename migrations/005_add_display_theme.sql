alter table rooms
  add column if not exists high_contrast boolean not null default false;

alter table rooms
  add column if not exists theme_color text not null default 'green';

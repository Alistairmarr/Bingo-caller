create table if not exists rooms (
  code text primary key,
  mode integer not null check (mode in (75, 90)),
  called jsonb not null default '[]'::jsonb,
  updated_at bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists rooms_updated_at_idx on rooms (updated_at);

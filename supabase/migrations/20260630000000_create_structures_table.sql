-- Migration: create structures table for persisting drawn garden structures
-- Generated: 2026-06-30

-- enable uuid gen
create extension if not exists "pgcrypto";

create table if not exists structures (
  id uuid primary key default gen_random_uuid(),
  yard_id uuid not null,
  type text not null,
  name text,
  geometry jsonb not null,
  z_index integer default 0,
  color text,
  pattern text,
  allow_plant_overlap text not null default 'full',
  grow_up_sides text[] default '{}',
  meta jsonb default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table structures
  add constraint structures_yard_fk foreign key (yard_id) references yards(id) on delete cascade;

create index if not exists structures_yard_idx on structures (yard_id);
create index if not exists structures_created_by_idx on structures (created_by);
create index if not exists structures_geometry_gin on structures using gin (geometry jsonb_path_ops);

-- Row-level security: enabled but policies added below (adapt as needed)
alter table structures enable row level security;

-- Policy: allow authenticated users to SELECT/INSERT/UPDATE/DELETE structures for yards they own
create policy "yard owners can manage structures" on structures
  for all
  using (
    exists (
      select 1 from yards where yards.id = structures.yard_id and yards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from yards where yards.id = structures.yard_id and yards.user_id = auth.uid()
    )
  );

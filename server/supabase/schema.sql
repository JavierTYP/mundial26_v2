-- Supabase/Postgres schema additions for user picks:
-- - Zamora (portero menos goleado)
-- - MVP (mejor jugador del torneo)
--
-- Run this in Supabase SQL Editor if your DB user does not have permission
-- to auto-create tables at runtime.

alter table if exists public.predictions
  add column if not exists winner text;

create table if not exists public.zamora_picks (
  email text primary key references public.users(email) on delete cascade,
  pick_json jsonb not null,
  updated_at text not null
);

-- Since you only access Supabase from the backend, lock down direct client access.
alter table public.zamora_picks enable row level security;
revoke all on table public.zamora_picks from anon, authenticated;

create table if not exists public.mvp_picks (
  email text primary key references public.users(email) on delete cascade,
  pick_json jsonb not null,
  updated_at text not null
);

alter table public.mvp_picks enable row level security;
revoke all on table public.mvp_picks from anon, authenticated;

-- Admin-managed "real results" (single-row tables, id=1)
create table if not exists public.goleadores_result (
  id integer primary key check (id = 1),
  picks_json jsonb not null,
  updated_at text not null
);

alter table public.goleadores_result enable row level security;
revoke all on table public.goleadores_result from anon, authenticated;

create table if not exists public.zamora_result (
  id integer primary key check (id = 1),
  pick_json jsonb not null,
  updated_at text not null
);

alter table public.zamora_result enable row level security;
revoke all on table public.zamora_result from anon, authenticated;

create table if not exists public.mvp_result (
  id integer primary key check (id = 1),
  pick_json jsonb not null,
  updated_at text not null
);

alter table public.mvp_result enable row level security;
revoke all on table public.mvp_result from anon, authenticated;

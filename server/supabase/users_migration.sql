-- public.users migration for Supabase Auth integration.
-- Keeps app-specific fields (role/nick) in public.users, while password remains in Supabase Auth (auth.users).
--
-- Notes:
-- - If `public.users` already exists, run this in Supabase SQL Editor.
-- - If you already have a primary key on `email`, you'll need to drop it first (see comments below).

-- 1) Ensure email is unique (required for FK references and upserts).
alter table public.users
  add constraint if not exists users_email_key unique (email);

-- 2) Add an internal numeric id (auto-increment).
alter table public.users
  add column if not exists user_id bigint generated always as identity;

-- If your `users` table currently has `email` as PRIMARY KEY, you may want to switch the PK to `user_id`:
-- alter table public.users drop constraint users_pkey;

alter table public.users
  add constraint if not exists users_pkey primary key (user_id);

-- 3) Link to Supabase Auth user id (uuid).
alter table public.users
  add column if not exists auth_user_id uuid;

alter table public.users
  add constraint if not exists users_auth_user_id_key unique (auth_user_id);

-- Optional: keep a nullable column for legacy compatibility (NOT used when Supabase Auth is enabled).
alter table public.users
  add column if not exists password_hash text;


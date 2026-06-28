-- ============================================================
-- simple-nvidia-chat schema — Neon Postgres
-- Run with: psql $DATABASE_URL -f schema.sql
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- users ----------
-- Stubbed: lib/auth.js always returns one fixed user id since
-- there's no login flow in this simple app.
create table if not exists users (
  id            text primary key,
  created_at    timestamptz not null default now()
);

-- ---------- threads ----------
-- One thread = one conversation, pinned to one model.
create table if not exists threads (
  id            uuid primary key default uuid_generate_v4(),
  user_id       text not null references users(id) on delete cascade,
  model         text not null,
  title         text not null default 'New conversation',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_threads_user on threads(user_id, updated_at desc);

-- ---------- messages ----------
create table if not exists messages (
  id            uuid primary key default uuid_generate_v4(),
  thread_id     uuid not null references threads(id) on delete cascade,
  role          text not null,            -- 'user' | 'assistant'
  content       text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_messages_thread on messages(thread_id, created_at asc);

-- ---------- updated_at trigger for threads ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_threads_updated_at on threads;
create trigger trg_threads_updated_at before update on threads
  for each row execute function set_updated_at();

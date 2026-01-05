-- OAuth state storage (prevents state forgery + replay)
create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('quickbooks')),
  state text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Enable RLS
alter table public.oauth_states enable row level security;

-- Users can only see their own OAuth states
create policy "Users can view own oauth states"
  on public.oauth_states for select
  using (auth.uid() = user_id);

-- Users can insert their own OAuth states
create policy "Users can create own oauth states"
  on public.oauth_states for insert
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists idx_oauth_states_user_provider
  on public.oauth_states(user_id, provider);

create index if not exists idx_oauth_states_expires
  on public.oauth_states(expires_at);

create index if not exists idx_oauth_states_state
  on public.oauth_states(state);

-- Cleanup helper function
create or replace function public.cleanup_expired_oauth_states()
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.oauth_states
  where expires_at < now() or used_at is not null;
$$;
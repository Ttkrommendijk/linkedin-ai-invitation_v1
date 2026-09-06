create table public.microsoft365_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'microsoft365' check (provider = 'microsoft365'),
  tenant_id text not null check (btrim(tenant_id) <> ''),
  microsoft_user_id text not null check (btrim(microsoft_user_id) <> ''),
  email text null,
  display_name text null,
  granted_scopes text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'reauthorization_required', 'revoked')),
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz null,
  last_verified_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint microsoft365_connections_owner_provider_unique unique (owner_user_id, provider),
  constraint microsoft365_connections_owner_identity_unique unique (id, owner_user_id),
  constraint microsoft365_connections_revoked_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create table public.microsoft365_connection_secrets (
  connection_id uuid primary key,
  owner_user_id uuid not null,
  encrypted_refresh_token text not null check (btrim(encrypted_refresh_token) <> ''),
  encryption_iv text not null check (btrim(encryption_iv) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint microsoft365_connection_secrets_owner_fk
    foreign key (connection_id, owner_user_id)
    references public.microsoft365_connections(id, owner_user_id)
    on delete cascade
);

create table public.microsoft365_oauth_states (
  state_hash text primary key check (btrim(state_hash) <> ''),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null check (btrim(code_verifier) <> ''),
  redirect_uri text not null check (btrim(redirect_uri) <> ''),
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint microsoft365_oauth_states_expiry_check check (expires_at > created_at)
);

create index microsoft365_connections_owner_status_idx on public.microsoft365_connections(owner_user_id, status);
create index microsoft365_oauth_states_owner_expiry_idx on public.microsoft365_oauth_states(owner_user_id, expires_at);

create or replace function public.microsoft365_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_microsoft365_connections_updated_at before update on public.microsoft365_connections
for each row execute function public.microsoft365_set_updated_at();
create trigger trg_microsoft365_connection_secrets_updated_at before update on public.microsoft365_connection_secrets
for each row execute function public.microsoft365_set_updated_at();

alter table public.microsoft365_connections enable row level security;
alter table public.microsoft365_connection_secrets enable row level security;
alter table public.microsoft365_oauth_states enable row level security;

revoke all on public.microsoft365_connections, public.microsoft365_connection_secrets, public.microsoft365_oauth_states from anon, authenticated;
grant all on public.microsoft365_connections, public.microsoft365_connection_secrets, public.microsoft365_oauth_states to service_role;

revoke all on function public.microsoft365_set_updated_at() from public, anon, authenticated;

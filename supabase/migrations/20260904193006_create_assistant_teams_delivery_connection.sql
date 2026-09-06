create table public.assistant_teams_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  teams_user_id text not null,
  teams_aad_object_id text not null,
  conversation_id text not null,
  service_url text not null,
  bot_id text not null,
  bot_name text,
  user_name text,
  status text not null default 'active' check (status in ('active', 'revoked', 'invalid')),
  installed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_teams_connections_owner_unique unique (owner_user_id),
  constraint assistant_teams_connections_tenant_user_unique unique (tenant_id, teams_aad_object_id),
  constraint assistant_teams_connections_service_url_check check (service_url ~ '^https://')
);

create trigger trg_assistant_teams_connections_updated_at
before update on public.assistant_teams_connections
for each row execute function public.assistant_set_updated_at();

alter table public.assistant_teams_connections enable row level security;
revoke all on public.assistant_teams_connections from public, anon, authenticated;
grant all on public.assistant_teams_connections to service_role;

comment on table public.assistant_teams_connections is
  'Private server-side Teams personal-chat delivery reference. Not exposed to ordinary clients.';

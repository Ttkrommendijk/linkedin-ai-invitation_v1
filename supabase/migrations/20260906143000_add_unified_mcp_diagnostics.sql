create table public.assistant_mcp_diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  request_id uuid not null,
  event_type text not null check (
    event_type in (
      'initialize',
      'initialized_notification',
      'ping',
      'catalog',
      'tools_list',
      'tools_call',
      'tool_result',
      'request_error'
    )
  ),
  rpc_method text,
  tool_name text,
  tool_domain text,
  server_instance_id uuid not null,
  session_fingerprint text not null,
  protocol_version text,
  client_fingerprint text not null,
  auth_ok boolean not null default true,
  success boolean,
  details jsonb not null default '{}'::jsonb,
  constraint assistant_mcp_diagnostic_details_object
    check (jsonb_typeof(details) = 'object')
);

comment on table public.assistant_mcp_diagnostic_events is
  'Privacy-preserving unified MCP lifecycle diagnostics. Never stores credentials, arguments, tool output, or business content.';

create index assistant_mcp_diagnostic_owner_time_idx
  on public.assistant_mcp_diagnostic_events (owner_user_id, occurred_at desc);

create index assistant_mcp_diagnostic_request_idx
  on public.assistant_mcp_diagnostic_events (request_id, occurred_at);

alter table public.assistant_mcp_diagnostic_events enable row level security;
revoke all on table public.assistant_mcp_diagnostic_events from anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'lef-unified-mcp-diagnostic-retention',
  '23 3 * * *',
  $job$
    delete from public.assistant_mcp_diagnostic_events
    where occurred_at < now() - interval '30 days';
  $job$
);

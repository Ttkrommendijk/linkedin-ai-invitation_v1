create table public.assistant_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  check_in_id uuid null,
  external_event_id text not null check (btrim(external_event_id) <> ''),
  external_ical_uid text null,
  title text not null check (btrim(title) <> ''),
  purpose text null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo' check (btrim(timezone) <> ''),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  transaction_key text not null check (btrim(transaction_key) <> ''),
  last_rescheduled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_calendar_blocks_range_check check (ends_at > starts_at),
  constraint assistant_calendar_blocks_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_calendar_blocks_connection_owner_fk
    foreign key (connection_id, owner_user_id)
    references public.microsoft365_connections(id, owner_user_id)
    on delete cascade,
  constraint assistant_calendar_blocks_check_in_owner_fk
    foreign key (check_in_id, owner_user_id)
    references public.assistant_check_ins(id, owner_user_id)
    on delete set null,
  constraint assistant_calendar_blocks_owner_transaction_unique unique (owner_user_id, transaction_key),
  constraint assistant_calendar_blocks_owner_event_unique unique (owner_user_id, external_event_id)
);

create index assistant_calendar_blocks_owner_start_idx
  on public.assistant_calendar_blocks(owner_user_id, status, starts_at);

create trigger trg_assistant_calendar_blocks_updated_at
before update on public.assistant_calendar_blocks
for each row execute function public.microsoft365_set_updated_at();

alter table public.assistant_calendar_blocks enable row level security;
revoke all on public.assistant_calendar_blocks from anon, authenticated;
grant select on public.assistant_calendar_blocks to authenticated;
grant all on public.assistant_calendar_blocks to service_role;

create policy assistant_calendar_blocks_select_own
on public.assistant_calendar_blocks for select to authenticated
using ((select auth.uid()) = owner_user_id);

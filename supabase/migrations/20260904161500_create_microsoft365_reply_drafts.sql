create table public.microsoft365_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  source_message_id text not null check (btrim(source_message_id) <> ''),
  external_draft_id text not null check (btrim(external_draft_id) <> ''),
  conversation_id text null,
  subject text null,
  status text not null default 'draft' check (status in ('draft', 'no_longer_draft', 'deleted', 'unknown')),
  transaction_key text not null check (btrim(transaction_key) <> ''),
  last_verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint microsoft365_reply_drafts_owner_identity_unique unique (id, owner_user_id),
  constraint microsoft365_reply_drafts_connection_owner_fk
    foreign key (connection_id, owner_user_id)
    references public.microsoft365_connections(id, owner_user_id)
    on delete cascade,
  constraint microsoft365_reply_drafts_owner_transaction_unique unique (owner_user_id, transaction_key),
  constraint microsoft365_reply_drafts_owner_external_unique unique (owner_user_id, external_draft_id)
);

create index microsoft365_reply_drafts_owner_status_idx
  on public.microsoft365_reply_drafts(owner_user_id, status, created_at desc);

create trigger trg_microsoft365_reply_drafts_updated_at
before update on public.microsoft365_reply_drafts
for each row execute function public.microsoft365_set_updated_at();

alter table public.microsoft365_reply_drafts enable row level security;
revoke all on public.microsoft365_reply_drafts from anon, authenticated;
grant select on public.microsoft365_reply_drafts to authenticated;
grant all on public.microsoft365_reply_drafts to service_role;

create policy microsoft365_reply_drafts_select_own
on public.microsoft365_reply_drafts for select to authenticated
using ((select auth.uid()) = owner_user_id);

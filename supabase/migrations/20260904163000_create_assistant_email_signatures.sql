create table public.assistant_email_signatures (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Standard' check (btrim(name) <> ''),
  html_content text not null check (btrim(html_content) <> '' and octet_length(html_content) <= 100000),
  text_fallback text not null check (btrim(text_fallback) <> '' and octet_length(text_fallback) <= 10000),
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index assistant_email_signatures_one_active_idx
  on public.assistant_email_signatures(owner_user_id)
  where status = 'active';

create trigger trg_assistant_email_signatures_updated_at
before update on public.assistant_email_signatures
for each row execute function public.microsoft365_set_updated_at();

alter table public.assistant_email_signatures enable row level security;
revoke all on public.assistant_email_signatures from anon, authenticated;
grant select on public.assistant_email_signatures to authenticated;
grant all on public.assistant_email_signatures to service_role;

create policy assistant_email_signatures_select_own
on public.assistant_email_signatures for select to authenticated
using ((select auth.uid()) = owner_user_id);

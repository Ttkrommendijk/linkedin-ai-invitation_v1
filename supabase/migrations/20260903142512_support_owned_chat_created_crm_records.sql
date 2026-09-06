alter table public.company
  add column if not exists owner_user_id uuid null references auth.users(id) on delete set null;

create index if not exists company_owner_user_id_idx
  on public.company(owner_user_id)
  where owner_user_id is not null;

alter table public.linkedin_invitations
  alter column linkedin_url drop not null;

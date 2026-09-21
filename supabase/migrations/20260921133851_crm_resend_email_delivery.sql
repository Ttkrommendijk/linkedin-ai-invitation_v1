-- CRM owns outbound intent/history; Resend owns delivery evidence.
create table public.crm_email_settings (
  owner_user_id uuid primary key references auth.users(id),
  from_address text not null,
  reply_to text not null,
  test_address text not null,
  enabled boolean not null default false,
  webhook_id text,
  webhook_secret text
);
create table public.crm_email_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  contact_id uuid references public.linkedin_invitations(id),
  campaign_id uuid references public.campaign(campaign_id),
  message_key text not null check (length(message_key) between 1 and 150),
  is_test boolean not null default false,
  recipient text not null,
  from_address text not null,
  reply_to text not null,
  subject text not null check (length(subject) between 1 and 200),
  body_text text not null check (length(body_text) between 1 and 10000),
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  state text not null default 'draft' check (state in ('draft','sending','accepted','uncertain','rejected','suppressed')),
  provider_id text unique,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  attempted_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  last_error text,
  note_id bigint references public.note(note_id),
  unique(owner_user_id, message_key, recipient),
  check (is_test or contact_id is not null)
);
create index crm_email_messages_contact_idx on public.crm_email_messages(contact_id);
create index crm_email_messages_campaign_idx on public.crm_email_messages(campaign_id);
create index crm_email_messages_note_idx on public.crm_email_messages(note_id);
create table public.crm_email_suppressions (
  owner_user_id uuid not null references auth.users(id),
  email text not null,
  reason text not null check (reason in ('unsubscribe','bounce','complaint','manual')),
  created_at timestamptz not null default now(),
  primary key(owner_user_id,email)
);
create table public.crm_email_events (
  event_id text primary key,
  message_id uuid not null references public.crm_email_messages(id),
  event_type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
create index crm_email_events_message_idx on public.crm_email_events(message_id);
-- Secrets and draft lifecycle are server-only. Each API operation checks the owner.
alter table public.crm_email_settings enable row level security;
alter table public.crm_email_messages enable row level security;
alter table public.crm_email_suppressions enable row level security;
alter table public.crm_email_events enable row level security;
revoke all on public.crm_email_settings,public.crm_email_messages,public.crm_email_suppressions,public.crm_email_events from public,anon,authenticated;
grant all on public.crm_email_settings,public.crm_email_messages,public.crm_email_suppressions,public.crm_email_events to service_role;

-- Trigger runs with the service caller's privileges. Note creation and provider
-- acceptance commit together, so a failed write can be safely reconciled.
create function public.crm_email_record_interaction() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.provider_id is not null and new.note_id is null and new.contact_id is not null then
    if not exists(select 1 from public.linkedin_invitations where id=new.contact_id and uuid=new.owner_user_id) then
      raise exception 'Email contact is not owned by this user';
    end if;
    insert into public.note(creator,main_person_id,note_title,note_description,notes_type,date,status,archived)
    values(new.owner_user_id,new.contact_id,new.subject,
      new.body_text || E'\n\nEmail submitted to Resend. Delivery is tracked separately.\nResend ID: ' || new.provider_id,
      'email',coalesce(new.accepted_at,now()),'ready',false)
    returning note_id into new.note_id;
  end if;
  return new;
end;
$$;
revoke all on function public.crm_email_record_interaction() from public,anon,authenticated;
grant execute on function public.crm_email_record_interaction() to service_role;
create trigger crm_email_record_interaction before update of provider_id on public.crm_email_messages
for each row execute function public.crm_email_record_interaction();

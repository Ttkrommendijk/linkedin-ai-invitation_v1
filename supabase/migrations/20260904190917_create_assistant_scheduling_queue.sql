create table public.assistant_attention_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  schedule_type text not null check (schedule_type in ('periodic', 'fixed_check_in', 'calendar_offset', 'deadline_offset', 'reminder_review', 'other')),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  timezone text not null default 'America/Sao_Paulo' check (btrim(timezone) <> ''),
  schedule_expression text null,
  next_run_at timestamptz null,
  offset_minutes integer null check (offset_minutes between -10080 and 10080),
  source_authority text null check (source_authority is null or source_authority in ('assistant', 'crm', 'projects', 'administration', 'outlook_calendar', 'outlook_mail', 'reminders', 'other')),
  source_record_type text null check (source_record_type is null or btrim(source_record_type) <> ''),
  source_external_id text null check (source_external_id is null or btrim(source_external_id) <> ''),
  eligibility_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(eligibility_policy) = 'object'),
  last_evaluated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_attention_schedules_source_complete_check check (
    (source_authority is null and source_record_type is null and source_external_id is null)
    or (source_authority is not null and source_record_type is not null and source_external_id is not null)
  ),
  constraint assistant_attention_schedules_timing_check check (
    schedule_expression is not null or next_run_at is not null or source_authority is not null
  ),
  constraint assistant_attention_schedules_owner_identity_unique unique (id, owner_user_id)
);

create unique index assistant_attention_schedules_owner_source_unique
on public.assistant_attention_schedules(owner_user_id, schedule_type, source_authority, source_record_type, source_external_id)
where source_authority is not null and status <> 'cancelled';

create table public.assistant_scheduled_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid null,
  intervention_id uuid null,
  delivery_key text not null check (btrim(delivery_key) <> ''),
  delivery_channel text not null default 'teams' check (delivery_channel in ('teams', 'chatgpt', 'other')),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'delivered', 'failed', 'cancelled', 'suppressed', 'expired')),
  deliver_at timestamptz not null,
  available_at timestamptz not null,
  expires_at timestamptz null,
  source_authority text not null check (source_authority in ('assistant', 'crm', 'projects', 'administration', 'outlook_calendar', 'outlook_mail', 'reminders', 'other')),
  source_record_type text not null check (btrim(source_record_type) <> ''),
  source_external_id text not null check (btrim(source_external_id) <> ''),
  source_version text null,
  rendered_title text not null check (btrim(rendered_title) <> ''),
  rendered_body text not null check (btrim(rendered_body) <> ''),
  discussion_target jsonb not null default '{}'::jsonb check (jsonb_typeof(discussion_target) = 'object'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  claimed_at timestamptz null,
  claimed_by text null,
  delivered_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_scheduled_deliveries_expiry_check check (expires_at is null or expires_at > deliver_at),
  constraint assistant_scheduled_deliveries_claim_check check (
    (status = 'claimed' and claimed_at is not null and claimed_by is not null)
    or status <> 'claimed'
  ),
  constraint assistant_scheduled_deliveries_delivery_check check (
    (status = 'delivered' and delivered_at is not null) or status <> 'delivered'
  ),
  constraint assistant_scheduled_deliveries_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_scheduled_deliveries_owner_key_unique unique (owner_user_id, delivery_key),
  constraint assistant_scheduled_deliveries_schedule_owner_fk foreign key (schedule_id, owner_user_id)
    references public.assistant_attention_schedules(id, owner_user_id) on delete restrict,
  constraint assistant_scheduled_deliveries_intervention_owner_fk foreign key (intervention_id, owner_user_id)
    references public.assistant_interventions(id, owner_user_id) on delete restrict
);

create table public.assistant_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  attempted_at timestamptz not null default now(),
  result text not null check (result in ('delivered', 'failed', 'suppressed', 'cancelled')),
  provider text not null check (btrim(provider) <> ''),
  provider_reference text null,
  error_code text null,
  error_message text null,
  response_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(response_metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint assistant_delivery_attempts_delivery_owner_fk foreign key (delivery_id, owner_user_id)
    references public.assistant_scheduled_deliveries(id, owner_user_id) on delete cascade,
  constraint assistant_delivery_attempts_delivery_number_unique unique (delivery_id, attempt_number)
);

create table public.assistant_schedule_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid null,
  delivery_id uuid null,
  event_type text not null check (event_type in ('created', 'rescheduled', 'cancelled', 'completed', 'source_changed', 'source_unavailable', 'refreshed', 'deduplicated')),
  occurred_at timestamptz not null default now(),
  previous_deliver_at timestamptz null,
  new_deliver_at timestamptz null,
  reason text null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint assistant_schedule_reconciliation_schedule_owner_fk foreign key (schedule_id, owner_user_id)
    references public.assistant_attention_schedules(id, owner_user_id) on delete restrict,
  constraint assistant_schedule_reconciliation_delivery_owner_fk foreign key (delivery_id, owner_user_id)
    references public.assistant_scheduled_deliveries(id, owner_user_id) on delete restrict
);

create index assistant_attention_schedules_due_idx
on public.assistant_attention_schedules(status, next_run_at)
where status = 'active';

create index assistant_scheduled_deliveries_due_idx
on public.assistant_scheduled_deliveries(status, available_at, deliver_at)
where status in ('queued', 'claimed');

create index assistant_scheduled_deliveries_owner_source_idx
on public.assistant_scheduled_deliveries(owner_user_id, source_authority, source_record_type, source_external_id);

create index assistant_delivery_attempts_owner_time_idx
on public.assistant_delivery_attempts(owner_user_id, attempted_at desc);

create index assistant_schedule_reconciliation_owner_time_idx
on public.assistant_schedule_reconciliation_events(owner_user_id, occurred_at desc);

create trigger trg_assistant_attention_schedules_updated_at before update on public.assistant_attention_schedules
for each row execute function public.assistant_set_updated_at();

create trigger trg_assistant_scheduled_deliveries_updated_at before update on public.assistant_scheduled_deliveries
for each row execute function public.assistant_set_updated_at();

alter table public.assistant_attention_schedules enable row level security;
alter table public.assistant_scheduled_deliveries enable row level security;
alter table public.assistant_delivery_attempts enable row level security;
alter table public.assistant_schedule_reconciliation_events enable row level security;

revoke all on public.assistant_attention_schedules, public.assistant_scheduled_deliveries, public.assistant_delivery_attempts, public.assistant_schedule_reconciliation_events from anon, authenticated;
grant select on public.assistant_attention_schedules, public.assistant_scheduled_deliveries, public.assistant_delivery_attempts, public.assistant_schedule_reconciliation_events to authenticated;
grant all on public.assistant_attention_schedules, public.assistant_scheduled_deliveries, public.assistant_delivery_attempts, public.assistant_schedule_reconciliation_events to service_role;

create policy assistant_attention_schedules_select_own on public.assistant_attention_schedules
for select to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_scheduled_deliveries_select_own on public.assistant_scheduled_deliveries
for select to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_delivery_attempts_select_own on public.assistant_delivery_attempts
for select to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_schedule_reconciliation_select_own on public.assistant_schedule_reconciliation_events
for select to authenticated using ((select auth.uid()) = owner_user_id);

create or replace function public.claim_due_assistant_deliveries(
  p_worker_id text,
  p_batch_size integer default 10,
  p_claim_timeout interval default interval '5 minutes'
)
returns setof public.assistant_scheduled_deliveries
language sql
security invoker
set search_path = ''
as $$
  with candidates as (
    select d.id
    from public.assistant_scheduled_deliveries d
    where (
      d.status = 'queued'
      or (d.status = 'claimed' and d.claimed_at < now() - p_claim_timeout)
    )
      and d.available_at <= now()
      and d.deliver_at <= now()
      and (d.expires_at is null or d.expires_at > now())
      and d.attempt_count < d.max_attempts
    order by d.deliver_at, d.created_at
    for update skip locked
    limit least(greatest(p_batch_size, 1), 100)
  )
  update public.assistant_scheduled_deliveries d
  set status = 'claimed',
      claimed_at = now(),
      claimed_by = btrim(p_worker_id),
      attempt_count = d.attempt_count + 1,
      updated_at = now()
  from candidates c
  where d.id = c.id
    and btrim(p_worker_id) <> ''
  returning d.*;
$$;

revoke all on function public.claim_due_assistant_deliveries(text, integer, interval) from public, anon, authenticated;
grant execute on function public.claim_due_assistant_deliveries(text, integer, interval) to service_role;

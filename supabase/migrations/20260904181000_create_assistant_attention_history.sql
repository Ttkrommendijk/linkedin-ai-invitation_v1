create table public.assistant_attention_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('event', 'periodic', 'morning_plan', 'end_of_day', 'weekly_sales', 'manual')),
  trigger_key text not null check (btrim(trigger_key) <> ''),
  evaluated_at timestamptz not null default now(),
  window_start timestamptz null,
  window_end timestamptz null,
  timezone text not null default 'America/Sao_Paulo' check (btrim(timezone) <> ''),
  decision text not null check (decision in ('no_action', 'pending_delivery', 'suppressed', 'failed')),
  reason text null,
  evidence_quality text not null default 'unknown' check (evidence_quality in ('unknown', 'partial', 'verified')),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_attention_evaluations_window_check check (window_end is null or window_start is not null),
  constraint assistant_attention_evaluations_window_order_check check (window_end is null or window_end > window_start),
  constraint assistant_attention_evaluations_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_attention_evaluations_owner_trigger_unique unique (owner_user_id, trigger_key)
);

create table public.assistant_interventions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null,
  check_in_id uuid null,
  transaction_key text not null check (btrim(transaction_key) <> ''),
  title text not null check (btrim(title) <> ''),
  reason text not null check (btrim(reason) <> ''),
  suggested_next_step text null,
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'urgent')),
  tone_level text not null default 'helpful' check (tone_level in ('helpful', 'direct', 'confronting')),
  status text not null default 'pending' check (status in ('pending', 'delivered', 'acknowledged', 'completed', 'scheduled', 'snoozed', 'blocked', 'rejected', 'failed', 'cancelled')),
  not_before timestamptz null,
  expires_at timestamptz null,
  delivered_at timestamptz null,
  next_review_at timestamptz null,
  local_day date not null,
  daily_sequence smallint not null default 1 check (daily_sequence between 1 and 99),
  exception_reason text null,
  outcome_note text null,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_interventions_expiry_check check (expires_at is null or not_before is null or expires_at > not_before),
  constraint assistant_interventions_delivery_check check (delivered_at is null or status <> 'pending'),
  constraint assistant_interventions_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_interventions_owner_transaction_unique unique (owner_user_id, transaction_key),
  constraint assistant_interventions_evaluation_owner_fk foreign key (evaluation_id, owner_user_id)
    references public.assistant_attention_evaluations(id, owner_user_id) on delete cascade,
  constraint assistant_interventions_check_in_owner_fk foreign key (check_in_id, owner_user_id)
    references public.assistant_check_ins(id, owner_user_id) on delete restrict
);

create table public.assistant_intervention_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  intervention_id uuid not null,
  authority_domain text not null check (authority_domain in ('assistant', 'crm', 'projects', 'administration', 'outlook_calendar', 'outlook_mail', 'reminders', 'other')),
  source_record_type text not null check (btrim(source_record_type) <> ''),
  source_external_id text not null check (btrim(source_external_id) <> ''),
  title text not null check (btrim(title) <> ''),
  summary text null,
  due_at timestamptz null,
  importance_rank smallint not null default 50 check (importance_rank between 1 and 100),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  constraint assistant_intervention_items_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_intervention_items_intervention_owner_fk foreign key (intervention_id, owner_user_id)
    references public.assistant_interventions(id, owner_user_id) on delete cascade,
  constraint assistant_intervention_items_source_unique unique (intervention_id, authority_domain, source_record_type, source_external_id)
);

create table public.assistant_intervention_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  intervention_id uuid not null,
  event_type text not null check (event_type in ('created', 'delivery_attempted', 'delivered', 'delivery_failed', 'acknowledged', 'completed', 'scheduled', 'snoozed', 'blocked', 'rejected', 'escalated', 'suppressed', 'cancelled')),
  actor_type text not null check (actor_type in ('assistant', 'user', 'system')),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint assistant_intervention_events_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_intervention_events_intervention_owner_fk foreign key (intervention_id, owner_user_id)
    references public.assistant_interventions(id, owner_user_id) on delete cascade
);

create index assistant_attention_evaluations_owner_time_idx on public.assistant_attention_evaluations(owner_user_id, evaluated_at desc);
create index assistant_interventions_owner_pending_idx on public.assistant_interventions(owner_user_id, status, not_before, next_review_at);
create index assistant_interventions_owner_item_day_idx on public.assistant_interventions(owner_user_id, local_day, daily_sequence);
create index assistant_intervention_items_owner_due_idx on public.assistant_intervention_items(owner_user_id, due_at);
create index assistant_intervention_events_owner_time_idx on public.assistant_intervention_events(owner_user_id, occurred_at desc);

create trigger trg_assistant_attention_evaluations_updated_at before update on public.assistant_attention_evaluations
for each row execute function public.assistant_set_updated_at();
create trigger trg_assistant_interventions_updated_at before update on public.assistant_interventions
for each row execute function public.assistant_set_updated_at();

alter table public.assistant_attention_evaluations enable row level security;
alter table public.assistant_interventions enable row level security;
alter table public.assistant_intervention_items enable row level security;
alter table public.assistant_intervention_events enable row level security;

revoke all on public.assistant_attention_evaluations, public.assistant_interventions, public.assistant_intervention_items, public.assistant_intervention_events from anon, authenticated;
grant select on public.assistant_attention_evaluations, public.assistant_interventions, public.assistant_intervention_items, public.assistant_intervention_events to authenticated;
grant all on public.assistant_attention_evaluations, public.assistant_interventions, public.assistant_intervention_items, public.assistant_intervention_events to service_role;

create policy assistant_attention_evaluations_select_own on public.assistant_attention_evaluations
for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_interventions_select_own on public.assistant_interventions
for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_intervention_items_select_own on public.assistant_intervention_items
for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_intervention_events_select_own on public.assistant_intervention_events
for select to authenticated using ((select auth.uid()) = owner_user_id);

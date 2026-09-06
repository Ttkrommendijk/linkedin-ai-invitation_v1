create table public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null check (memory_type in ('preference', 'priority', 'routine', 'work_pattern', 'context', 'decision', 'other')),
  content text not null check (btrim(content) <> ''),
  confirmation_state text not null default 'inferred' check (confirmation_state in ('inferred', 'confirmed')),
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'sensitive')),
  source_domain text not null default 'assistant' check (source_domain in ('assistant', 'crm', 'projects', 'administration', 'outlook_calendar', 'outlook_mail', 'reminders', 'conversation', 'other')),
  source_record_type text null,
  source_external_id text null,
  source_url text null,
  confidence numeric null check (confidence is null or (confidence >= 0 and confidence <= 1)),
  learned_at timestamptz not null default now(),
  corrected_at timestamptz null,
  expires_at timestamptz null,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_memories_sensitive_confirmation_check check (
    sensitivity <> 'sensitive' or confirmation_state = 'confirmed'
  ),
  constraint assistant_memories_owner_identity_unique unique (id, owner_user_id)
);

create table public.assistant_check_ins (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  check_in_type text not null check (check_in_type in ('morning_plan', 'proactive_intervention', 'end_of_day', 'project', 'weekly_sales', 'administration_weekly', 'administration_monthly', 'other')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  reason text null,
  summary text null,
  source_external_id text null,
  rescheduled_to_id uuid null,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_check_ins_completed_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint assistant_check_ins_rescheduled_check check (
    (status = 'rescheduled' and rescheduled_to_id is not null)
    or (status <> 'rescheduled' and rescheduled_to_id is null)
  ),
  constraint assistant_check_ins_not_self_rescheduled check (rescheduled_to_id is null or rescheduled_to_id <> id),
  constraint assistant_check_ins_owner_identity_unique unique (id, owner_user_id),
  constraint assistant_check_ins_rescheduled_owner_fk
    foreign key (rescheduled_to_id, owner_user_id)
    references public.assistant_check_ins(id, owner_user_id)
    on delete restrict
);

create table public.assistant_weekly_targets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  category text not null check (category in ('sales', 'delivery', 'projects', 'administration', 'marketing', 'other')),
  metric_key text not null check (btrim(metric_key) <> ''),
  label text not null check (btrim(label) <> ''),
  target_value numeric not null check (target_value >= 0),
  unit text not null check (btrim(unit) <> ''),
  actual_value numeric null check (actual_value is null or actual_value >= 0),
  status text not null default 'active' check (status in ('active', 'met', 'missed', 'cancelled')),
  evidence_quality text not null default 'unknown' check (evidence_quality in ('unknown', 'partial', 'verified')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_weekly_targets_monday_check check (extract(isodow from week_start) = 1),
  constraint assistant_weekly_targets_owner_metric_unique unique (owner_user_id, week_start, category, metric_key),
  constraint assistant_weekly_targets_owner_identity_unique unique (id, owner_user_id)
);

create table public.assistant_weekly_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'completed', 'reopened')),
  evidence_quality text not null default 'unknown' check (evidence_quality in ('unknown', 'partial', 'verified')),
  summary text null,
  wins text null,
  gaps text null,
  recommendations text null,
  completed_at timestamptz null,
  source_external_id text null,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_weekly_evaluations_monday_check check (extract(isodow from week_start) = 1),
  constraint assistant_weekly_evaluations_completed_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint assistant_weekly_evaluations_owner_week_unique unique (owner_user_id, week_start),
  constraint assistant_weekly_evaluations_owner_identity_unique unique (id, owner_user_id)
);

create table public.assistant_commitments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  details text null,
  status text not null default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled')),
  due_at timestamptz null,
  confirmed_at timestamptz not null,
  completed_at timestamptz null,
  authority_domain text not null check (authority_domain in ('assistant', 'crm', 'projects', 'administration', 'outlook_calendar', 'outlook_mail', 'reminders', 'other')),
  source_domain text not null check (source_domain in ('assistant', 'crm', 'projects', 'administration', 'outlook_calendar', 'outlook_mail', 'reminders', 'conversation', 'other')),
  source_record_type text null,
  source_external_id text null,
  source_url text null,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_commitments_completed_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint assistant_commitments_owner_identity_unique unique (id, owner_user_id)
);

create unique index assistant_memories_source_unique
  on public.assistant_memories(owner_user_id, source_domain, source_record_type, source_external_id)
  where source_external_id is not null;
create index assistant_memories_owner_expiry_idx on public.assistant_memories(owner_user_id, expires_at);
create unique index assistant_check_ins_source_unique
  on public.assistant_check_ins(owner_user_id, check_in_type, source_external_id)
  where source_external_id is not null;
create index assistant_check_ins_owner_schedule_idx on public.assistant_check_ins(owner_user_id, status, scheduled_at);
create index assistant_weekly_targets_owner_week_idx on public.assistant_weekly_targets(owner_user_id, week_start desc);
create index assistant_weekly_evaluations_owner_week_idx on public.assistant_weekly_evaluations(owner_user_id, week_start desc);
create unique index assistant_commitments_source_unique
  on public.assistant_commitments(owner_user_id, source_domain, source_record_type, source_external_id)
  where source_external_id is not null;
create index assistant_commitments_owner_status_due_idx on public.assistant_commitments(owner_user_id, status, due_at);

create or replace function public.assistant_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_assistant_memories_updated_at before update on public.assistant_memories
for each row execute function public.assistant_set_updated_at();
create trigger trg_assistant_check_ins_updated_at before update on public.assistant_check_ins
for each row execute function public.assistant_set_updated_at();
create trigger trg_assistant_weekly_targets_updated_at before update on public.assistant_weekly_targets
for each row execute function public.assistant_set_updated_at();
create trigger trg_assistant_weekly_evaluations_updated_at before update on public.assistant_weekly_evaluations
for each row execute function public.assistant_set_updated_at();
create trigger trg_assistant_commitments_updated_at before update on public.assistant_commitments
for each row execute function public.assistant_set_updated_at();

alter table public.assistant_memories enable row level security;
alter table public.assistant_check_ins enable row level security;
alter table public.assistant_weekly_targets enable row level security;
alter table public.assistant_weekly_evaluations enable row level security;
alter table public.assistant_commitments enable row level security;

revoke all on public.assistant_memories, public.assistant_check_ins, public.assistant_weekly_targets, public.assistant_weekly_evaluations, public.assistant_commitments from anon;
grant select, insert, update, delete on public.assistant_memories, public.assistant_check_ins, public.assistant_weekly_targets, public.assistant_weekly_evaluations, public.assistant_commitments to authenticated;
grant all on public.assistant_memories, public.assistant_check_ins, public.assistant_weekly_targets, public.assistant_weekly_evaluations, public.assistant_commitments to service_role;

create policy assistant_memories_select_own on public.assistant_memories for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_memories_insert_own on public.assistant_memories for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy assistant_memories_update_own on public.assistant_memories for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy assistant_memories_delete_own on public.assistant_memories for delete to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_check_ins_select_own on public.assistant_check_ins for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_check_ins_insert_own on public.assistant_check_ins for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy assistant_check_ins_update_own on public.assistant_check_ins for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy assistant_check_ins_delete_own on public.assistant_check_ins for delete to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_weekly_targets_select_own on public.assistant_weekly_targets for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_weekly_targets_insert_own on public.assistant_weekly_targets for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy assistant_weekly_targets_update_own on public.assistant_weekly_targets for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy assistant_weekly_targets_delete_own on public.assistant_weekly_targets for delete to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_weekly_evaluations_select_own on public.assistant_weekly_evaluations for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_weekly_evaluations_insert_own on public.assistant_weekly_evaluations for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy assistant_weekly_evaluations_update_own on public.assistant_weekly_evaluations for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy assistant_weekly_evaluations_delete_own on public.assistant_weekly_evaluations for delete to authenticated using ((select auth.uid()) = owner_user_id);

create policy assistant_commitments_select_own on public.assistant_commitments for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy assistant_commitments_insert_own on public.assistant_commitments for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy assistant_commitments_update_own on public.assistant_commitments for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy assistant_commitments_delete_own on public.assistant_commitments for delete to authenticated using ((select auth.uid()) = owner_user_id);

revoke all on function public.assistant_set_updated_at() from public, anon, authenticated;

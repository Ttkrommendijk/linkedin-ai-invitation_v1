alter table public.assistant_check_ins
  drop constraint assistant_check_ins_check_in_type_check;

alter table public.assistant_check_ins
  add constraint assistant_check_ins_check_in_type_check
  check (
    check_in_type in (
      'morning_plan',
      'midday_review',
      'proactive_intervention',
      'end_of_day',
      'project',
      'weekly_sales',
      'weekly_workspace',
      'weekend_review',
      'workspace_review',
      'conversation',
      'administration_weekly',
      'administration_monthly',
      'other'
    )
  );

alter table public.assistant_check_ins
  add column local_day date,
  add column timezone text not null default 'America/Sao_Paulo',
  add column digest_version integer,
  add column last_summarized_at timestamptz,
  add constraint assistant_check_ins_timezone_not_blank_check
    check (btrim(timezone) <> ''),
  add constraint assistant_check_ins_digest_version_check
    check (digest_version is null or digest_version >= 1);

update public.assistant_check_ins
set local_day = (coalesce(started_at, scheduled_at, created_at) at time zone timezone)::date
where local_day is null;

alter table public.assistant_check_ins
  alter column local_day set default ((now() at time zone 'America/Sao_Paulo')::date),
  alter column local_day set not null;

create index assistant_check_ins_owner_local_day_idx
  on public.assistant_check_ins(owner_user_id, local_day, created_at desc);

alter table public.assistant_commitments
  add column check_in_id uuid,
  add constraint assistant_commitments_check_in_owner_fk
    foreign key (check_in_id, owner_user_id)
    references public.assistant_check_ins(id, owner_user_id)
    on delete restrict;

create index assistant_commitments_owner_check_in_idx
  on public.assistant_commitments(owner_user_id, check_in_id)
  where check_in_id is not null;

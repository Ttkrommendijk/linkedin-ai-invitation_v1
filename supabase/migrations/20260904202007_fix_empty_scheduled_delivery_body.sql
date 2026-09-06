create or replace function public.materialize_time_bound_assistant_deliveries(
  p_now timestamptz default now(),
  p_horizon interval default interval '7 days'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  affected integer := 0;
begin
  if p_horizon <= interval '0' or p_horizon > interval '31 days' then
    raise exception 'materialization horizon must be between zero and 31 days';
  end if;

  update public.assistant_scheduled_deliveries d
  set status = 'cancelled', claimed_at = null, claimed_by = null,
      last_error = 'authoritative reminder timing or lifecycle changed'
  where d.source_authority = 'reminders'
    and d.source_record_type = 'reminder_due'
    and d.status in ('queued','claimed')
    and not exists (
      select 1 from public.crm_reminders r
      where r.owner_user_id = d.owner_user_id
        and r.id::text = d.source_external_id
        and r.status in ('open','snoozed')
        and (case when r.status = 'snoozed' then r.snoozed_until else r.due_at end) is not null
        and (case when r.status = 'snoozed' then r.snoozed_until else r.due_at end)::text = d.source_version
);
  insert into public.assistant_scheduled_deliveries (
    owner_user_id, delivery_key, delivery_channel, status, deliver_at, available_at, expires_at,
    source_authority, source_record_type, source_external_id, source_version,
    rendered_title, rendered_body, discussion_target, payload
  )
  select r.owner_user_id,
         'reminder:' || r.id::text || ':due:' || extract(epoch from effective.at)::bigint,
         'teams','queued',effective.at,effective.at,effective.at + interval '1 day',
         'reminders','reminder_due',r.id::text,effective.at::text,
         r.title,
         coalesce(
           nullif(
             concat_ws(E'\n\n', nullif(btrim(r.details),''),
               case when r.priority_override is not null then 'Priority: ' || r.priority_override
                    when r.inferred_reason is not null then 'Why now: ' || r.inferred_reason end),
             ''
           ),
           'This reminder is due now.'
         ),
         jsonb_build_object('authority','reminders','record_type','reminder','record_id',r.id),
         jsonb_build_object('due_at',r.due_at,'next_review_at',r.next_review_at,'status',r.status)
  from public.crm_reminders r
  cross join lateral (select case when r.status = 'snoozed' then r.snoozed_until else r.due_at end as at) effective
  where r.status in ('open','snoozed') and effective.at is not null
    and effective.at >= p_now and effective.at <= p_now + p_horizon
  on conflict (owner_user_id, delivery_key) do nothing;
  get diagnostics affected = row_count; inserted_count := inserted_count + affected;

  update public.assistant_scheduled_deliveries d
  set status = 'cancelled', claimed_at = null, claimed_by = null,
      last_error = 'authoritative check-in timing or lifecycle changed'
  where d.source_authority = 'assistant' and d.source_record_type = 'check_in'
    and d.status in ('queued','claimed')
    and not exists (
      select 1 from public.assistant_check_ins c
      where c.owner_user_id = d.owner_user_id and c.id::text = d.source_external_id
        and c.status = 'planned' and c.scheduled_at is not null and c.scheduled_at::text = d.source_version
    );

  insert into public.assistant_scheduled_deliveries (
    owner_user_id, delivery_key, delivery_channel, status, deliver_at, available_at, expires_at,
    source_authority, source_record_type, source_external_id, source_version,
    rendered_title, rendered_body, discussion_target, payload
  )
  select c.owner_user_id,
         'check-in:' || c.id::text || ':' || extract(epoch from c.scheduled_at)::bigint,
         'teams','queued',c.scheduled_at,c.scheduled_at,c.scheduled_at + interval '4 hours',
         'assistant','check_in',c.id::text,c.scheduled_at::text,
         case c.check_in_type when 'morning_plan' then 'Morning plan'
           when 'end_of_day' then 'End-of-day review'
           when 'weekly_sales' then 'Weekly sales review'
           when 'administration_weekly' then 'Weekly administration check'
           when 'administration_monthly' then 'Monthly administration review'
           else 'LEF check-in' end,
         coalesce(nullif(btrim(c.reason),''),'Open LEF Assistant to review what needs attention.'),
         jsonb_build_object('authority','assistant','record_type','check_in','record_id',c.id),
         jsonb_build_object('check_in_type',c.check_in_type)
  from public.assistant_check_ins c
  where c.status = 'planned' and c.scheduled_at is not null
    and c.scheduled_at >= p_now and c.scheduled_at <= p_now + p_horizon
  on conflict (owner_user_id, delivery_key) do nothing;
  get diagnostics affected = row_count; inserted_count := inserted_count + affected;

  update public.assistant_scheduled_deliveries d
  set status = 'cancelled', claimed_at = null, claimed_by = null,
      last_error = 'authoritative commitment timing or lifecycle changed'
  where d.source_authority = 'assistant' and d.source_record_type = 'commitment_due'
    and d.status in ('queued','claimed')
    and not exists (
      select 1 from public.assistant_commitments c
      where c.owner_user_id = d.owner_user_id and c.id::text = d.source_external_id
        and c.status = 'confirmed' and c.due_at is not null and c.due_at::text = d.source_version
    );

  insert into public.assistant_scheduled_deliveries (
    owner_user_id, delivery_key, delivery_channel, status, deliver_at, available_at, expires_at,
    source_authority, source_record_type, source_external_id, source_version,
    rendered_title, rendered_body, discussion_target, payload
  )
  select c.owner_user_id,
         'commitment:' || c.id::text || ':due:' || extract(epoch from c.due_at)::bigint,
         'teams','queued',c.due_at,c.due_at,c.due_at + interval '1 day',
         'assistant','commitment_due',c.id::text,c.due_at::text,
         c.title,
         concat_ws(E'\n\n',nullif(btrim(c.details),''),'This is a confirmed commitment due now.'),
         jsonb_build_object('authority',c.authority_domain,'record_type','commitment','record_id',c.id),
         jsonb_build_object('source_domain',c.source_domain,'due_at',c.due_at)
  from public.assistant_commitments c
  where c.status = 'confirmed' and c.due_at is not null
    and c.due_at >= p_now and c.due_at <= p_now + p_horizon
  on conflict (owner_user_id, delivery_key) do nothing;
  get diagnostics affected = row_count; inserted_count := inserted_count + affected;

  return inserted_count;
end;
$$;

revoke all on function public.materialize_time_bound_assistant_deliveries(timestamptz, interval) from public, anon, authenticated;
grant execute on function public.materialize_time_bound_assistant_deliveries(timestamptz, interval) to service_role;

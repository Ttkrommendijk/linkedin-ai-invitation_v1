alter table public.crm_reminders add column if not exists due_on date;
alter table public.project_actions add column if not exists due_on date;

alter table public.crm_reminders add constraint crm_reminders_one_due_kind
  check (due_at is null or due_on is null);
alter table public.project_actions add constraint project_actions_one_due_kind
  check (due_at is null or due_on is null);

create index if not exists crm_reminders_owner_due_on_idx
  on public.crm_reminders(owner_user_id, due_on) where due_on is not null;
create index if not exists project_actions_owner_due_on_idx
  on public.project_actions(owner_user_id, status, due_on) where due_on is not null;

create or replace function public.sync_project_action_reminder()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  reminder_row public.crm_reminders;
  reminder_status text;
  event_name text;
  reminder_found boolean := false;
  review_at timestamptz;
begin
  if new.status = 'completed' then new.completed_at := coalesce(new.completed_at, now()); reminder_status := 'completed';
  elsif new.status = 'cancelled' then new.completed_at := null; reminder_status := 'cancelled';
  else new.completed_at := null; reminder_status := 'open'; end if;

  if new.due_at is not null and new.due_on is not null then raise exception 'due_at and due_on are mutually exclusive'; end if;
  review_at := coalesce(new.due_at, (new.due_on::timestamp + time '07:30') at time zone 'America/Sao_Paulo');

  if new.due_at is null and new.due_on is null then
    if new.reminder_id is not null then
      update public.crm_reminders set status='cancelled', completed_at=null where id=new.reminder_id and owner_user_id=new.owner_user_id returning * into reminder_row;
      if found then insert into public.crm_reminder_events(reminder_id,owner_user_id,event_type,event_data) values(new.reminder_id,new.owner_user_id,'cancelled',jsonb_build_object('reason','project_action_due_date_removed')); end if;
    end if;
    return new;
  end if;

  if new.reminder_id is not null then select * into reminder_row from public.crm_reminders where id=new.reminder_id and owner_user_id=new.owner_user_id; reminder_found := found; end if;
  if not reminder_found then
    insert into public.crm_reminders(owner_user_id,title,details,status,due_at,due_on,next_review_at,completed_at,source_type,source_external_id,context)
    values(new.owner_user_id,new.title,new.details,reminder_status,new.due_at,new.due_on,review_at,case when reminder_status='completed' then new.completed_at end,'other','project_action:'||new.id::text,jsonb_build_object('project_action_id',new.id,'project_id',new.project_id,'date_only',new.due_on is not null))
    returning * into reminder_row;
    new.reminder_id := reminder_row.id;
    insert into public.crm_reminder_events(reminder_id,owner_user_id,event_type,event_data) values(reminder_row.id,new.owner_user_id,'created',jsonb_build_object('source','project_action'));
  else
    event_name := case when reminder_row.status in ('completed','cancelled') and reminder_status='open' then 'reopened' when reminder_status='completed' then 'completed' when reminder_status='cancelled' then 'cancelled' else 'updated' end;
    update public.crm_reminders set title=new.title,details=new.details,status=reminder_status,due_at=new.due_at,due_on=new.due_on,
      next_review_at=case when reminder_status='open' then least(review_at,coalesce(next_review_at,review_at)) else next_review_at end,
      snoozed_until=case when reminder_status='open' then null else snoozed_until end,
      completed_at=case when reminder_status='completed' then new.completed_at end,
      context=coalesce(context,'{}'::jsonb)||jsonb_build_object('project_action_id',new.id,'project_id',new.project_id,'date_only',new.due_on is not null)
    where id=new.reminder_id and owner_user_id=new.owner_user_id;
    insert into public.crm_reminder_events(reminder_id,owner_user_id,event_type,event_data) values(new.reminder_id,new.owner_user_id,event_name,jsonb_build_object('source','project_action'));
  end if;
  return new;
end; $$;

drop trigger if exists trg_project_actions_sync_reminder on public.project_actions;
create trigger trg_project_actions_sync_reminder before insert or update of title,details,status,due_at,due_on,owner_user_id,project_id
on public.project_actions for each row execute function public.sync_project_action_reminder();

create or replace function public.materialize_date_only_reminder_deliveries(p_now timestamptz default now(), p_horizon interval default interval '7 days')
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer := 0; affected integer := 0;
begin
  update public.assistant_scheduled_deliveries d set status='cancelled',claimed_at=null,claimed_by=null,last_error='date-only reminder changed or closed'
  where d.source_authority='reminders' and d.source_record_type='reminder_date_checkin' and d.status in ('queued','claimed')
    and not exists(select 1 from public.crm_reminders r where r.owner_user_id=d.owner_user_id and r.id::text=d.source_external_id and r.status='open' and r.due_on::text=d.source_version);

  insert into public.assistant_scheduled_deliveries(owner_user_id,delivery_key,delivery_channel,status,deliver_at,available_at,expires_at,source_authority,source_record_type,source_external_id,source_version,rendered_title,rendered_body,discussion_target,payload)
  select r.owner_user_id,'reminder:'||r.id||':date:'||r.due_on||':'||v.phase,'teams','queued',v.at,v.at,v.at+interval '4 hours','reminders','reminder_date_checkin',r.id::text,r.due_on::text,r.title,
    case v.phase when 'morning' then 'Today you need to do this.' when 'midday' then 'Have you done this?' else 'Don''t forget this before the day ends.' end,
    jsonb_build_object('authority','reminders','record_type','reminder','record_id',r.id),jsonb_build_object('due_on',r.due_on,'date_only',true,'checkin_phase',v.phase)
  from public.crm_reminders r
  cross join lateral (values
    ('morning', (r.due_on::timestamp+time '07:30') at time zone 'America/Sao_Paulo'),
    ('midday', (r.due_on::timestamp+time '11:55') at time zone 'America/Sao_Paulo'),
    ('end_of_day', (r.due_on::timestamp+time '17:00') at time zone 'America/Sao_Paulo')
  ) v(phase,at)
  where r.status='open' and r.due_on is not null and v.at>=p_now and v.at<=p_now+p_horizon
  on conflict(owner_user_id,delivery_key) do nothing;
  get diagnostics affected=row_count; inserted_count:=inserted_count+affected;
  return inserted_count;
end; $$;

revoke all on function public.materialize_date_only_reminder_deliveries(timestamptz,interval) from public,anon,authenticated;
grant execute on function public.materialize_date_only_reminder_deliveries(timestamptz,interval) to service_role;

select cron.schedule('lef-date-only-reminder-materializer','* * * * *','select public.materialize_date_only_reminder_deliveries();');

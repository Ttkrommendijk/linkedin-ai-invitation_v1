create or replace function public.sync_project_action_reminder()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  reminder_row public.crm_reminders;
  reminder_status text;
  event_name text;
  reminder_found boolean := false;
begin
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    reminder_status := 'completed';
  elsif new.status = 'cancelled' then
    new.completed_at := null;
    reminder_status := 'cancelled';
  else
    new.completed_at := null;
    reminder_status := 'open';
  end if;

  if new.due_at is null then
    if new.reminder_id is not null then
      update public.crm_reminders
      set status = 'cancelled', completed_at = null
      where id = new.reminder_id and owner_user_id = new.owner_user_id
      returning * into reminder_row;
      if found then
        insert into public.crm_reminder_events(reminder_id, owner_user_id, event_type, event_data)
        values (new.reminder_id, new.owner_user_id, 'cancelled', jsonb_build_object('reason', 'project_action_due_date_removed'));
      end if;
    end if;
    return new;
  end if;

  if new.reminder_id is not null then
    select * into reminder_row
    from public.crm_reminders
    where id = new.reminder_id and owner_user_id = new.owner_user_id;
    reminder_found := found;
  end if;

  if not reminder_found then
    insert into public.crm_reminders (
      owner_user_id, title, details, status, due_at, next_review_at,
      completed_at, source_type, source_external_id, context
    ) values (
      new.owner_user_id,
      new.title,
      new.details,
      reminder_status,
      new.due_at,
      new.due_at,
      case when reminder_status = 'completed' then new.completed_at else null end,
      'other',
      'project_action:' || new.id::text,
      jsonb_build_object('project_action_id', new.id, 'project_id', new.project_id)
    )
    returning * into reminder_row;
    new.reminder_id := reminder_row.id;
    insert into public.crm_reminder_events(reminder_id, owner_user_id, event_type, event_data)
    values (reminder_row.id, new.owner_user_id, 'created', jsonb_build_object('source', 'project_action'));
  else
    event_name := case
      when reminder_row.status in ('completed', 'cancelled') and reminder_status = 'open' then 'reopened'
      when reminder_status = 'completed' then 'completed'
      when reminder_status = 'cancelled' then 'cancelled'
      else 'updated'
    end;
    update public.crm_reminders
    set title = new.title,
        details = new.details,
        status = reminder_status,
        due_at = new.due_at,
        next_review_at = case when reminder_status = 'open' then least(new.due_at, coalesce(next_review_at, new.due_at)) else next_review_at end,
        snoozed_until = case when reminder_status = 'open' then null else snoozed_until end,
        completed_at = case when reminder_status = 'completed' then new.completed_at else null end,
        context = coalesce(context, '{}'::jsonb) || jsonb_build_object('project_action_id', new.id, 'project_id', new.project_id)
    where id = new.reminder_id and owner_user_id = new.owner_user_id;
    insert into public.crm_reminder_events(reminder_id, owner_user_id, event_type, event_data)
    values (new.reminder_id, new.owner_user_id, event_name, jsonb_build_object('source', 'project_action'));
  end if;

  return new;
end;
$$;

revoke all on function public.sync_project_action_reminder() from public, anon, authenticated;

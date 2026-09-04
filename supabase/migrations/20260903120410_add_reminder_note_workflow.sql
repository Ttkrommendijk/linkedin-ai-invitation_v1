alter table public.crm_reminders
  add column if not exists completed_by_note_id bigint
  references public.note(note_id) on delete set null;

create index if not exists crm_reminders_completed_by_note_idx
  on public.crm_reminders(completed_by_note_id);

create or replace function public.create_note_with_optional_reminder(
  p_note_title text default null,
  p_note_description text default null,
  p_occurred_at timestamptz default now(),
  p_status public.note_status default 'ready',
  p_notes_type public.note_type default 'note',
  p_duration bigint default null,
  p_main_person_id uuid default null,
  p_company_id uuid default null,
  p_deal_id uuid default null,
  p_create_reminder boolean default false,
  p_reminder_title text default null,
  p_reminder_at timestamptz default null,
  p_reminder_kind text default 'due'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_note public.note;
  v_reminder public.crm_reminders;
  v_reminder_title text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_create_reminder and p_reminder_at is null then
    raise exception 'A reminder date is required';
  end if;
  if p_reminder_kind not in ('due', 'review') then
    raise exception 'Reminder kind must be due or review';
  end if;

  insert into public.note (
    note_title, note_description, creator, main_person_id, company_id, deal_id,
    status, date, notes_type, duration
  ) values (
    nullif(btrim(p_note_title), ''), nullif(btrim(p_note_description), ''),
    v_user_id, p_main_person_id, p_company_id, p_deal_id,
    p_status, coalesce(p_occurred_at, now()), p_notes_type, p_duration
  ) returning * into v_note;

  if p_create_reminder then
    v_reminder_title := coalesce(
      nullif(btrim(p_reminder_title), ''),
      nullif(btrim(p_note_title), ''),
      'Follow up'
    );
    insert into public.crm_reminders (
      owner_user_id, title, status, due_at, next_review_at,
      contact_id, company_id, deal_id, source_note_id, source_type
    ) values (
      v_user_id, v_reminder_title, 'open',
      case when p_reminder_kind = 'due' then p_reminder_at end,
      p_reminder_at, p_main_person_id, p_company_id, p_deal_id,
      v_note.note_id, 'note'
    ) returning * into v_reminder;

    insert into public.crm_reminder_events (
      reminder_id, owner_user_id, event_type, event_data
    ) values (
      v_reminder.id, v_user_id, 'created',
      jsonb_build_object('source', 'note', 'source_note_id', v_note.note_id)
    );
  end if;

  return jsonb_build_object('note', to_jsonb(v_note), 'reminder', to_jsonb(v_reminder));
end;
$$;

create or replace function public.complete_reminder_with_note(
  p_reminder_id uuid,
  p_note_title text default null,
  p_note_description text default null,
  p_occurred_at timestamptz default now(),
  p_notes_type public.note_type default 'note',
  p_duration bigint default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reminder public.crm_reminders;
  v_note public.note;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_reminder
  from public.crm_reminders
  where id = p_reminder_id and owner_user_id = v_user_id
  for update;

  if not found then raise exception 'Reminder not found'; end if;
  if v_reminder.status not in ('open', 'snoozed') then
    raise exception 'Only active reminders can be completed';
  end if;

  insert into public.note (
    note_title, note_description, creator, main_person_id, company_id, deal_id,
    status, date, notes_type, duration
  ) values (
    coalesce(nullif(btrim(p_note_title), ''), v_reminder.title),
    nullif(btrim(p_note_description), ''), v_user_id,
    v_reminder.contact_id, v_reminder.company_id, v_reminder.deal_id,
    'ready', coalesce(p_occurred_at, now()), p_notes_type, p_duration
  ) returning * into v_note;

  update public.crm_reminders
  set status = 'completed', completed_at = now(), snoozed_until = null,
      completed_by_note_id = v_note.note_id
  where id = v_reminder.id
  returning * into v_reminder;

  insert into public.crm_reminder_events (
    reminder_id, owner_user_id, event_type, event_data
  ) values (
    v_reminder.id, v_user_id, 'completed',
    jsonb_build_object('completed_by_note_id', v_note.note_id)
  );

  return jsonb_build_object('note', to_jsonb(v_note), 'reminder', to_jsonb(v_reminder));
end;
$$;

revoke all on function public.create_note_with_optional_reminder(text,text,timestamptz,public.note_status,public.note_type,bigint,uuid,uuid,uuid,boolean,text,timestamptz,text) from public, anon;
grant execute on function public.create_note_with_optional_reminder(text,text,timestamptz,public.note_status,public.note_type,bigint,uuid,uuid,uuid,boolean,text,timestamptz,text) to authenticated;
revoke all on function public.complete_reminder_with_note(uuid,text,text,timestamptz,public.note_type,bigint) from public, anon;
grant execute on function public.complete_reminder_with_note(uuid,text,text,timestamptz,public.note_type,bigint) to authenticated;

create or replace view public.vw_contact_next_reminder
with (security_invoker = true) as
select i.id as contact_id,
       i.linkedin_url,
       r.id as next_reminder_id,
       r.title as next_reminder_title,
       coalesce(r.snoozed_until, r.due_at, r.next_review_at) as next_reminder_at,
       counts.active_reminder_count
from public.linkedin_invitations i
left join lateral (
  select cr.id, cr.title, cr.snoozed_until, cr.due_at, cr.next_review_at
  from public.crm_reminders cr
  where cr.contact_id = i.id and cr.status in ('open', 'snoozed')
  order by coalesce(cr.snoozed_until, cr.due_at, cr.next_review_at), cr.created_at
  limit 1
) r on true
left join lateral (
  select count(*)::integer as active_reminder_count
  from public.crm_reminders cr
  where cr.contact_id = i.id and cr.status in ('open', 'snoozed')
) counts on true;

create or replace view public.vw_company_next_reminder
with (security_invoker = true) as
select c.company_id,
       r.id as next_reminder_id,
       r.title as next_reminder_title,
       coalesce(r.snoozed_until, r.due_at, r.next_review_at) as next_reminder_at,
       counts.active_reminder_count
from public.company c
left join lateral (
  select cr.id, cr.title, cr.snoozed_until, cr.due_at, cr.next_review_at
  from public.crm_reminders cr
  where cr.company_id = c.company_id and cr.status in ('open', 'snoozed')
  order by coalesce(cr.snoozed_until, cr.due_at, cr.next_review_at), cr.created_at
  limit 1
) r on true
left join lateral (
  select count(*)::integer as active_reminder_count
  from public.crm_reminders cr
  where cr.company_id = c.company_id and cr.status in ('open', 'snoozed')
) counts on true;

grant select on public.vw_contact_next_reminder, public.vw_company_next_reminder to authenticated;

create or replace view public.vw_linkedin_invitations_reminder_overview
with (security_invoker = true) as
select base.*, nr.next_reminder_id, nr.next_reminder_title,
       nr.next_reminder_at, coalesce(nr.active_reminder_count, 0) as active_reminder_count
from public.vw_linkedin_invitations_overview base
left join public.vw_contact_next_reminder nr on nr.linkedin_url = base.url;

create or replace view public.vw_company_reminder_overview
with (security_invoker = true) as
select base.*, nr.next_reminder_id, nr.next_reminder_title,
       nr.next_reminder_at, coalesce(nr.active_reminder_count, 0) as active_reminder_count
from public.vw_company_overview base
left join public.vw_company_next_reminder nr on nr.company_id = base.company_id;

create or replace view public.notes_with_reminders_view
with (security_invoker = true) as
select n.*,
       source.id as source_reminder_id,
       source.title as source_reminder_title,
       coalesce(source.due_at, source.next_review_at) as source_reminder_at,
       completed.id as completed_reminder_id,
       completed.title as completed_reminder_title
from public.notes_view n
left join lateral (
  select r.id, r.title, r.due_at, r.next_review_at
  from public.crm_reminders r
  where r.source_note_id = n.note_id
  order by r.created_at desc limit 1
) source on true
left join lateral (
  select r.id, r.title
  from public.crm_reminders r
  where r.completed_by_note_id = n.note_id
  order by r.completed_at desc limit 1
) completed on true;

grant select on public.vw_linkedin_invitations_reminder_overview,
  public.vw_company_reminder_overview, public.notes_with_reminders_view to authenticated;

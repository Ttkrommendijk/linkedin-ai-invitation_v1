create or replace function public.admin_confirm_document_match(
  p_workspace_id uuid,
  p_transaction_id uuid,
  p_document_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_transaction public.admin_transactions%rowtype;
  v_document public.admin_documents%rowtype;
  v_match public.admin_document_matches%rowtype;
begin
  select * into v_transaction
  from public.admin_transactions
  where id = p_transaction_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'transaction was not found in this workspace'; end if;

  select * into v_document
  from public.admin_documents
  where id = p_document_id and workspace_id = p_workspace_id;
  if not found then raise exception 'document was not found in this workspace'; end if;

  insert into public.admin_document_matches (
    workspace_id, transaction_id, document_id, status, match_method,
    confidence, reasons, decided_by, decided_at, updated_at
  ) values (
    p_workspace_id, p_transaction_id, p_document_id, 'confirmed', 'manual',
    1,
    jsonb_build_array(
      jsonb_build_object('factor','confirmation','detail','Confirmed by user'),
      jsonb_build_object(
        'factor','period',
        'detail', case
          when v_document.period_id is distinct from v_transaction.period_id
            then 'Cross-period supporting document confirmed'
          else 'Transaction and document share an administration period'
        end
      )
    ),
    p_user_id, now(), now()
  )
  on conflict (transaction_id, document_id) do update set
    status = 'confirmed',
    match_method = case when public.admin_document_matches.match_method = 'automatic' then 'manual' else public.admin_document_matches.match_method end,
    confidence = greatest(coalesce(public.admin_document_matches.confidence, 0), 1),
    reasons = case
      when v_document.period_id is distinct from v_transaction.period_id
        then coalesce(public.admin_document_matches.reasons, '[]'::jsonb)
          || jsonb_build_array(
            jsonb_build_object('factor','confirmation','detail','Confirmed by user'),
            jsonb_build_object('factor','period','detail','Cross-period supporting document confirmed')
          )
      else coalesce(public.admin_document_matches.reasons, '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('factor','confirmation','detail','Confirmed by user'))
    end,
    decided_by = excluded.decided_by,
    decided_at = excluded.decided_at,
    updated_at = excluded.updated_at
  returning * into v_match;

  update public.admin_transactions
  set reconciliation_status = 'matched', updated_at = now()
  where id = p_transaction_id;

  return jsonb_build_object(
    'match', to_jsonb(v_match),
    'transaction_id', p_transaction_id,
    'document_id', p_document_id,
    'transaction_period_id', v_transaction.period_id,
    'document_period_id', v_document.period_id,
    'cross_period', v_document.period_id is distinct from v_transaction.period_id,
    'reconciliation_status', 'matched'
  );
end;
$function$;

revoke all on function public.admin_confirm_document_match(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_confirm_document_match(uuid, uuid, uuid, uuid) to service_role;;

create schema if not exists crm_email_private;
revoke all on schema crm_email_private from public,anon,authenticated;
grant usage on schema crm_email_private to service_role;
create function crm_email_private.resend_api_key() returns text
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb ->> 'role' is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name='RESEND_API_KEY');
end;
$$;
revoke all on function crm_email_private.resend_api_key() from public,anon,authenticated;
grant execute on function crm_email_private.resend_api_key() to service_role;
create function public.crm_resend_api_key() returns text
language sql security invoker set search_path = ''
as $$ select crm_email_private.resend_api_key(); $$;
revoke all on function public.crm_resend_api_key() from public,anon,authenticated;
grant execute on function public.crm_resend_api_key() to service_role;

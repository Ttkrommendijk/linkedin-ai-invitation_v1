do $$
begin
  if not exists (select 1 from vault.secrets where name = 'automations_api_key') then
    raise exception 'Vault secret automations_api_key is required before scheduling Calendar reconciliation';
  end if;
end
$$;

select cron.schedule(
  'lef-calendar-alert-reconciliation',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://nkhujuqjnbzsfqyqfndc.supabase.co/functions/v1/lef-microsoft365-oauth/reconcile-calendar-alerts',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'automations_api_key'
        )
      ),
      body := '{}'::jsonb
    );
  $job$
);

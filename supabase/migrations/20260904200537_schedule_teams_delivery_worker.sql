create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'automations_api_key'
  ) then
    raise exception 'Vault secret automations_api_key is required before scheduling the Teams delivery worker';
  end if;
end
$$;

select cron.schedule(
  'lef-teams-delivery-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://nkhujuqjnbzsfqyqfndc.supabase.co/functions/v1/lef-teams-bot/dispatch',
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

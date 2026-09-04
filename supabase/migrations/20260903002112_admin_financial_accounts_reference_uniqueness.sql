create unique index if not exists admin_financial_accounts_workspace_reference_key
on public.admin_financial_accounts (workspace_id, account_reference)
where account_reference is not null;;

alter table public.admin_statements
  add column if not exists opening_balance numeric,
  add column if not exists closing_balance numeric;

comment on column public.admin_statements.opening_balance is
  'Opening balance reported by the source statement, when available.';

comment on column public.admin_statements.closing_balance is
  'Closing ledger balance reported by the source statement, when available.';;

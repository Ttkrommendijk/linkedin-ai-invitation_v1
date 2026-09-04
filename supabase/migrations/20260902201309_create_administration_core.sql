
create table public.admin_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  owner_user_id uuid references auth.users(id) on delete set null,
  base_currency text not null default 'BRL' check (base_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Sao_Paulo',
  sharepoint_site_id text,
  sharepoint_site_url text,
  sharepoint_drive_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  period_start date not null,
  status text not null default 'collecting'
    check (status in ('collecting','reconciling','review','ready','delivered','closed')),
  sharepoint_folder_id text,
  sharepoint_folder_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_start),
  check (period_start = date_trunc('month', period_start)::date)
);

create table public.admin_financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  account_type text not null check (account_type in ('bank','credit_card')),
  institution_name text not null,
  display_name text not null,
  account_reference text,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, display_name)
);

create table public.admin_source_emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  sender_address text not null,
  sender_name text,
  subject text,
  received_at timestamptz not null,
  classification text not null default 'unclassified'
    check (classification in ('unclassified','useful','ignored','review')),
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','processed','needs_review','failed','ignored')),
  ignore_reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, gmail_message_id)
);

create table public.admin_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  source_email_id uuid references public.admin_source_emails(id) on delete set null,
  period_id uuid references public.admin_periods(id) on delete set null,
  document_type text not null default 'other'
    check (document_type in (
      'bank_statement','credit_card_statement','supplier_invoice','sales_invoice',
      'receipt','tax_document','payment_proof','contract','other'
    )),
  direction text not null default 'unknown'
    check (direction in ('incoming','outgoing','unknown')),
  original_filename text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-fA-F]{64}$'),
  sharepoint_drive_id text,
  sharepoint_item_id text,
  sharepoint_web_url text,
  issue_date date,
  due_date date,
  counterparty_name text,
  counterparty_tax_id text,
  document_number text,
  total_amount numeric(18,2),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','stored','extracting','extracted','needs_review','failed')),
  extracted_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sha256)
);

create table public.admin_statements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  period_id uuid not null references public.admin_periods(id) on delete cascade,
  account_id uuid not null references public.admin_financial_accounts(id) on delete restrict,
  document_id uuid not null references public.admin_documents(id) on delete restrict,
  statement_type text not null check (statement_type in ('bank','credit_card')),
  period_from date,
  period_to date,
  closing_date date,
  due_date date,
  declared_total numeric(18,2),
  import_status text not null default 'pending'
    check (import_status in ('pending','importing','imported','needs_review','failed')),
  imported_at timestamptz,
  source_format text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create table public.admin_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  period_id uuid not null references public.admin_periods(id) on delete cascade,
  statement_id uuid not null references public.admin_statements(id) on delete cascade,
  account_id uuid not null references public.admin_financial_accounts(id) on delete restrict,
  source_row_key text not null,
  transaction_date date not null,
  posted_date date,
  description text not null,
  counterparty_name text,
  normalized_counterparty text,
  amount numeric(18,2) not null,
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  transaction_kind text not null default 'unknown'
    check (transaction_kind in ('expense','income','transfer','fee','refund','payment','unknown')),
  installment_number integer check (installment_number is null or installment_number > 0),
  installment_count integer check (installment_count is null or installment_count > 0),
  reconciliation_status text not null default 'unmatched'
    check (reconciliation_status in ('unmatched','proposed','matched','missing_document','ignored')),
  raw_data jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (statement_id, source_row_key),
  check (
    installment_number is null or installment_count is null
    or installment_number <= installment_count
  )
);

create table public.admin_document_matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  transaction_id uuid not null references public.admin_transactions(id) on delete cascade,
  document_id uuid not null references public.admin_documents(id) on delete cascade,
  status text not null default 'proposed'
    check (status in ('proposed','confirmed','rejected')),
  match_method text not null default 'automatic'
    check (match_method in ('automatic','rule','manual')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id, document_id)
);

create table public.admin_sender_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  sender_pattern text not null,
  subject_pattern text,
  action text not null check (action in ('process','ignore','review')),
  document_type text check (document_type is null or document_type in (
    'bank_statement','credit_card_statement','supplier_invoice','sales_invoice',
    'receipt','tax_document','payment_proof','contract','other'
  )),
  priority integer not null default 100,
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  period_id uuid references public.admin_periods(id) on delete cascade,
  source_email_id uuid references public.admin_source_emails(id) on delete set null,
  document_id uuid references public.admin_documents(id) on delete set null,
  transaction_id uuid references public.admin_transactions(id) on delete set null,
  issue_type text not null,
  severity text not null default 'warning'
    check (severity in ('info','warning','error')),
  status text not null default 'open'
    check (status in ('open','resolved','dismissed')),
  title text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  period_id uuid not null references public.admin_periods(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','ready_for_review','approved','sent','failed')),
  sharepoint_item_id text,
  sharepoint_web_url text,
  contents jsonb not null default '{}'::jsonb check (jsonb_typeof(contents) = 'object'),
  accountant_recipient text,
  gmail_draft_id text,
  prepared_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id)
);

create table public.admin_audit_events (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.admin_workspaces(id) on delete cascade,
  actor_type text not null check (actor_type in ('user','agent','automation','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  check (before_data is null or jsonb_typeof(before_data) = 'object'),
  check (after_data is null or jsonb_typeof(after_data) = 'object')
);

create index admin_periods_workspace_status_idx
  on public.admin_periods (workspace_id, status, period_start desc);
create index admin_accounts_workspace_type_idx
  on public.admin_financial_accounts (workspace_id, account_type) where active;
create index admin_source_emails_received_idx
  on public.admin_source_emails (workspace_id, received_at desc);
create index admin_source_emails_pending_idx
  on public.admin_source_emails (workspace_id, processing_status, received_at)
  where processing_status in ('pending','needs_review','failed');
create index admin_documents_period_type_idx
  on public.admin_documents (period_id, document_type);
create index admin_documents_source_email_idx
  on public.admin_documents (source_email_id);
create index admin_documents_sharepoint_item_idx
  on public.admin_documents (sharepoint_item_id)
  where sharepoint_item_id is not null;
create index admin_statements_period_idx
  on public.admin_statements (period_id, statement_type);
create index admin_statements_account_idx
  on public.admin_statements (account_id, period_to desc);
create index admin_transactions_period_status_idx
  on public.admin_transactions (period_id, reconciliation_status, transaction_date);
create index admin_transactions_unmatched_idx
  on public.admin_transactions (workspace_id, transaction_date, amount)
  where reconciliation_status in ('unmatched','proposed','missing_document');
create index admin_transactions_account_idx
  on public.admin_transactions (account_id, transaction_date desc);
create index admin_matches_transaction_status_idx
  on public.admin_document_matches (transaction_id, status, confidence desc);
create index admin_matches_document_idx
  on public.admin_document_matches (document_id);
create index admin_sender_rules_lookup_idx
  on public.admin_sender_rules (workspace_id, active, priority, sender_pattern);
create index admin_issues_open_idx
  on public.admin_issues (workspace_id, severity, created_at)
  where status = 'open';
create index admin_issues_period_idx
  on public.admin_issues (period_id, status);
create index admin_audit_entity_idx
  on public.admin_audit_events (workspace_id, entity_type, entity_id, created_at desc);
create index admin_audit_created_idx
  on public.admin_audit_events (workspace_id, created_at desc);

create function public.admin_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admin_workspaces_touch_updated_at
before update on public.admin_workspaces
for each row execute function public.admin_touch_updated_at();
create trigger admin_periods_touch_updated_at
before update on public.admin_periods
for each row execute function public.admin_touch_updated_at();
create trigger admin_financial_accounts_touch_updated_at
before update on public.admin_financial_accounts
for each row execute function public.admin_touch_updated_at();
create trigger admin_source_emails_touch_updated_at
before update on public.admin_source_emails
for each row execute function public.admin_touch_updated_at();
create trigger admin_documents_touch_updated_at
before update on public.admin_documents
for each row execute function public.admin_touch_updated_at();
create trigger admin_statements_touch_updated_at
before update on public.admin_statements
for each row execute function public.admin_touch_updated_at();
create trigger admin_transactions_touch_updated_at
before update on public.admin_transactions
for each row execute function public.admin_touch_updated_at();
create trigger admin_document_matches_touch_updated_at
before update on public.admin_document_matches
for each row execute function public.admin_touch_updated_at();
create trigger admin_sender_rules_touch_updated_at
before update on public.admin_sender_rules
for each row execute function public.admin_touch_updated_at();
create trigger admin_issues_touch_updated_at
before update on public.admin_issues
for each row execute function public.admin_touch_updated_at();
create trigger admin_packages_touch_updated_at
before update on public.admin_packages
for each row execute function public.admin_touch_updated_at();

alter table public.admin_workspaces enable row level security;
alter table public.admin_periods enable row level security;
alter table public.admin_financial_accounts enable row level security;
alter table public.admin_source_emails enable row level security;
alter table public.admin_documents enable row level security;
alter table public.admin_statements enable row level security;
alter table public.admin_transactions enable row level security;
alter table public.admin_document_matches enable row level security;
alter table public.admin_sender_rules enable row level security;
alter table public.admin_issues enable row level security;
alter table public.admin_packages enable row level security;
alter table public.admin_audit_events enable row level security;

revoke all on table public.admin_workspaces from public, anon, authenticated;
revoke all on table public.admin_periods from public, anon, authenticated;
revoke all on table public.admin_financial_accounts from public, anon, authenticated;
revoke all on table public.admin_source_emails from public, anon, authenticated;
revoke all on table public.admin_documents from public, anon, authenticated;
revoke all on table public.admin_statements from public, anon, authenticated;
revoke all on table public.admin_transactions from public, anon, authenticated;
revoke all on table public.admin_document_matches from public, anon, authenticated;
revoke all on table public.admin_sender_rules from public, anon, authenticated;
revoke all on table public.admin_issues from public, anon, authenticated;
revoke all on table public.admin_packages from public, anon, authenticated;
revoke all on table public.admin_audit_events from public, anon, authenticated;

grant select, insert, update, delete on table
  public.admin_workspaces,
  public.admin_periods,
  public.admin_financial_accounts,
  public.admin_source_emails,
  public.admin_documents,
  public.admin_statements,
  public.admin_transactions,
  public.admin_document_matches,
  public.admin_sender_rules,
  public.admin_issues,
  public.admin_packages
to service_role;

grant select, insert on table public.admin_audit_events to service_role;
grant usage, select on sequence public.admin_audit_events_id_seq to service_role;

revoke all on function public.admin_touch_updated_at() from public, anon, authenticated;
grant execute on function public.admin_touch_updated_at() to service_role;

comment on table public.admin_workspaces is 'Top-level administration workspace and SharePoint configuration.';
comment on table public.admin_source_emails is 'Gmail messages considered by the administration workflow; message bodies are not stored here.';
comment on table public.admin_documents is 'Metadata and SharePoint references for financial documents; file contents live in SharePoint.';
comment on table public.admin_transactions is 'Imported bank and credit-card statement lines.';
comment on table public.admin_document_matches is 'Proposed, confirmed, or rejected links between transactions and supporting documents.';
comment on table public.admin_sender_rules is 'Reusable process, ignore, or review rules for recurring email senders and subjects.';
comment on table public.admin_audit_events is 'Append-oriented audit history for user and agent actions.';
;

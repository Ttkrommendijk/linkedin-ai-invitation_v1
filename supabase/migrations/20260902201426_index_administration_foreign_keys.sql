
create index admin_workspaces_owner_user_idx
  on public.admin_workspaces (owner_user_id)
  where owner_user_id is not null;

create index admin_matches_workspace_idx
  on public.admin_document_matches (workspace_id);
create index admin_matches_decided_by_idx
  on public.admin_document_matches (decided_by)
  where decided_by is not null;

create index admin_issues_source_email_idx
  on public.admin_issues (source_email_id)
  where source_email_id is not null;
create index admin_issues_document_idx
  on public.admin_issues (document_id)
  where document_id is not null;
create index admin_issues_transaction_idx
  on public.admin_issues (transaction_id)
  where transaction_id is not null;
create index admin_issues_resolved_by_idx
  on public.admin_issues (resolved_by)
  where resolved_by is not null;

create index admin_packages_workspace_idx
  on public.admin_packages (workspace_id);
create index admin_packages_approved_by_idx
  on public.admin_packages (approved_by)
  where approved_by is not null;

create index admin_sender_rules_created_by_idx
  on public.admin_sender_rules (created_by)
  where created_by is not null;

create index admin_statements_workspace_idx
  on public.admin_statements (workspace_id);

create index admin_audit_actor_user_idx
  on public.admin_audit_events (actor_user_id)
  where actor_user_id is not null;
;

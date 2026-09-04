create index if not exists admin_delivery_actions_approved_by_idx on public.admin_delivery_actions (approved_by);
create index if not exists admin_delivery_actions_document_fk_idx on public.admin_delivery_actions (document_id);
create index if not exists admin_delivery_actions_package_fk_idx on public.admin_delivery_actions (package_id);
create index if not exists admin_delivery_actions_period_fk_idx on public.admin_delivery_actions (period_id);
create index if not exists admin_delivery_actions_request_fk_idx on public.admin_delivery_actions (request_id);
create index if not exists admin_delivery_requests_period_fk_idx on public.admin_delivery_requests (period_id);
create index if not exists admin_delivery_requests_source_email_idx on public.admin_delivery_requests (source_email_id);;

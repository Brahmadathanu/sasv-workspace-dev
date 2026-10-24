-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table public.godown_master_audit enable row level security;
alter table public.proc_indent_line_balance_generation enable row level security;
alter table public.proc_indent_line_priority_generation enable row level security;
alter table public.proc_indent_line_sourcing_decision enable row level security;
alter table public.proc_lifecycle_audit enable row level security;
alter table public.proc_vendor enable row level security;
alter table public.proc_vendor_item_candidate_generation enable row level security;
alter table public.product_master_audit enable row level security;
alter table public.product_sku_master_audit enable row level security;
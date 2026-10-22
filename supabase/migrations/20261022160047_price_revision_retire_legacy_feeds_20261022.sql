-- Legacy price-revision feeds retired after dependency and repo-client audit.
-- Canonical successor: costing.v_price_revision_current_approved_master.
-- Intentionally no CASCADE.
DROP VIEW IF EXISTS public.v_costing_pricing_price_revision_feed_approved;
DROP VIEW IF EXISTS costing.v_price_revision_feed_approved;

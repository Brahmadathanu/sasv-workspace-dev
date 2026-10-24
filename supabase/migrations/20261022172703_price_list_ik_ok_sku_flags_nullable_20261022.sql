ALTER TABLE public.product_skus ADD COLUMN IF NOT EXISTS price_list_ik boolean, ADD COLUMN IF NOT EXISTS price_list_ok boolean;
COMMENT ON COLUMN public.product_skus.price_list_ik IS 'Inside Kerala price-list membership, sourced from CS - PRODUCT PRICING DATABASE / PRODUCT PRICING, column PRICE LIST IK. TRUE=Y; FALSE=N; NULL=unverified/unmatched.';
COMMENT ON COLUMN public.product_skus.price_list_ok IS 'Outside Kerala price-list membership, sourced from CS - PRODUCT PRICING DATABASE / PRODUCT PRICING, column PRICE LIST OK. TRUE=Y; FALSE=N; NULL=unverified/unmatched.';

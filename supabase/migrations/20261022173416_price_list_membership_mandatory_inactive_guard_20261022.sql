-- Price-list membership must always be explicit and cannot be TRUE for inactive SKUs.
UPDATE public.product_skus
SET price_list_ik = CASE WHEN is_active THEN COALESCE(price_list_ik,FALSE) ELSE FALSE END,
    price_list_ok = CASE WHEN is_active THEN COALESCE(price_list_ok,FALSE) ELSE FALSE END
WHERE price_list_ik IS NULL OR price_list_ok IS NULL OR
      (NOT is_active AND (price_list_ik OR price_list_ok));
ALTER TABLE public.product_skus
  ALTER COLUMN price_list_ik SET DEFAULT FALSE,
  ALTER COLUMN price_list_ok SET DEFAULT FALSE,
  ALTER COLUMN price_list_ik SET NOT NULL,
  ALTER COLUMN price_list_ok SET NOT NULL;
CREATE OR REPLACE FUNCTION public.fn_product_skus_price_list_active_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT NEW.is_active THEN
    NEW.price_list_ik := FALSE;
    NEW.price_list_ok := FALSE;
  ELSE
    NEW.price_list_ik := COALESCE(NEW.price_list_ik,FALSE);
    NEW.price_list_ok := COALESCE(NEW.price_list_ok,FALSE);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_product_skus_price_list_active_guard
BEFORE INSERT OR UPDATE ON public.product_skus
FOR EACH ROW EXECUTE FUNCTION public.fn_product_skus_price_list_active_guard();
ALTER TABLE public.product_skus
  ADD CONSTRAINT product_skus_inactive_not_price_listed
  CHECK (is_active OR (NOT price_list_ik AND NOT price_list_ok));
COMMENT ON COLUMN public.product_skus.price_list_ik IS 'Mandatory IK price-list inclusion; default FALSE; inactive SKUs always FALSE; imported verified memberships from CS PRODUCT PRICING.';
COMMENT ON COLUMN public.product_skus.price_list_ok IS 'Mandatory OK price-list inclusion; default FALSE; inactive SKUs always FALSE; imported verified memberships from CS PRODUCT PRICING.';

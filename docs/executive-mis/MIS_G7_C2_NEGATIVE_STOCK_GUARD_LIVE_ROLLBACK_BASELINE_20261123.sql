-- Exact live negative balance trigger baseline captured under READ ONLY.
-- SHA-256 UTF8: 211a6e879999cb97d4c28a9017cff66fb3ee493fedead10c36c4d0b81f6a1090
-- DO NOT EXECUTE without separately approved coordinated rollback.

CREATE OR REPLACE FUNCTION public.fn_fg_ledger_check_negative()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
DECLARE
  new_total numeric;
BEGIN
  SELECT COALESCE(SUM(qty_base),0) + NEW.qty_base
  INTO new_total
  FROM public.fg_bulk_stock_ledger
  WHERE product_id   = NEW.product_id
    AND batch_number = NEW.batch_number;

  IF new_total < 0 THEN
    RAISE EXCEPTION 'Cannot post % % for product %, BN %: would make stock negative (%.3f)',
      NEW.qty_base, (SELECT uom_base FROM products WHERE id = NEW.product_id),
      NEW.product_id, NEW.batch_number, new_total;
  END IF;

  RETURN NEW;
END;
$function$


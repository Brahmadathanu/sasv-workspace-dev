-- Rollback for MIS G7 S2-S4 migrations. NOT in supabase/migrations. Owner-authorized use only.
-- No legacy function was replaced by these migrations, so the legacy baselines are untouched:
--   trg_fg_ledger_from_es  sha256 cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28
--   fn_fg_ledger_check_negative sha256 211a6e879999cb97d4c28a9017cff66fb3ee493fedead10c36c4d0b81f6a1090
-- Signed history (app_private.mis_* tables) is deliberately RETAINED.
DROP FUNCTION IF EXISTS public.mis_pack_fg_bulk_v1(uuid,integer,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.mis_correct_batch_stage_v1(uuid,bigint,text);
DROP FUNCTION IF EXISTS public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text);
DROP TRIGGER IF EXISTS "00_mis_g7_fg_batch_lock" ON public.fg_bulk_stock_ledger;
DROP FUNCTION IF EXISTS app_private.trg_mis_fg_ledger_batch_lock();

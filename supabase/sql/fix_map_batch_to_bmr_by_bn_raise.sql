-- Fix RAISE in map_batch_to_bmr_by_bn to use a valid condition/SQLSTATE
-- Symptom observed in app: "unrecognized exception condition \"CHECK_VIOLATION\""
-- Cause: Using an unrecognized/quoted condition name in RAISE (e.g., RAISE "CHECK_VIOLATION";)
-- Postgres expects either the unquoted condition keyword (check_violation) or a SQLSTATE code.
-- Recommended pattern below uses SQLSTATE '23514' (check_violation).

-- NOTE: This is a template; adjust the function body/validation and schema as per your DB.
-- Run this script in Supabase SQL editor or psql after adapting the validation section.

create or replace function public.map_batch_to_bmr_by_bn(
  p_batch_id int,
  p_bn text
) returns void
language plpgsql as $$
declare
  v_ok boolean := true;
begin
  -- TODO: perform your existing lookups and validations here
  -- set v_ok := false and raise if a validation fails

  if not v_ok then
    -- Use a proper SQLSTATE for check violations
    raise sqlstate '23514' using message = 'Mapping violates a business rule (check failed)';
    -- Alternatively:
    -- raise exception using errcode = '23514', message = 'Mapping violates a business rule (check failed)';
    -- Or condition keyword (do NOT quote it):
    -- raise check_violation using message = 'Mapping violates a business rule (check failed)';
  end if;

  -- TODO: perform the mapping
end;
$$;

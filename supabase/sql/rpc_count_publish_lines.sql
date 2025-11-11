-- RPC: return total count of publish lines for a given publish header
CREATE OR REPLACE FUNCTION public.count_publish_lines(p_plan_id bigint)
RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT count(*) FROM public.plan_publish_lines WHERE plan_id = p_plan_id;
$$;

-- Example grant:
-- GRANT EXECUTE ON FUNCTION public.count_publish_lines(bigint) TO anon;

COMMENT ON FUNCTION public.count_publish_lines(bigint) IS 'Return total number of lines for a publish header';

-- G7 C2/C3 decision contracts. SYNTHETIC SQL ONLY / zero writes.
-- These prove CASE ordering, not real locking, cross-session concurrency or RLS.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5500ms';
WITH scenarios(id,has_fg_receipt,signed_route,available,requested,
 signed_excess,excess_authorized,excess_committed,already_replayed,
 source_unmodified,expected) AS (
 VALUES
 ('missing_fg',false,false,0::numeric,2::numeric,0::numeric,false,false,false,true,'DENY_MISSING_FG'),
 ('unsigned_fg',true,false,6::numeric,2::numeric,0::numeric,false,false,false,true,'DENY_UNSIGNED_FG'),
 ('regular_valid',true,true,6::numeric,2::numeric,0::numeric,false,false,false,true,'POST_PACK'),
 ('negative_or_zero_pack',true,true,6::numeric,0::numeric,0::numeric,false,false,false,true,'DENY_INVALID_QTY'),
 ('short_no_excess',true,true,1::numeric,2::numeric,0::numeric,false,false,false,true,'DENY_SHORT'),
 ('unsigned_excess',true,true,1::numeric,2::numeric,1::numeric,false,false,false,true,'DENY_EXCESS_AUTH'),
 ('authorized_not_committed',true,true,1::numeric,2::numeric,1::numeric,true,false,false,true,'DENY_EXCESS_NOT_COMMITTED'),
 ('atomic_authorized',true,true,1::numeric,2::numeric,1::numeric,true,true,false,true,'POST_PACK_WITH_EXCESS'),
 ('insufficient_even_after',true,true,1::numeric,3::numeric,1::numeric,true,true,false,true,'DENY_SHORT'),
 ('replay_already_posted',true,true,4::numeric,2::numeric,0::numeric,false,false,true,true,'RETURN_EXISTING'),
 ('replay_source_changed',true,true,4::numeric,2::numeric,0::numeric,false,false,true,false,'CONFLICT_SOURCE_CHANGED'),
 ('route_excess_no_fg',false,true,0::numeric,2::numeric,2::numeric,true,true,false,true,'DENY_MISSING_FG')
),result AS (
 SELECT id,expected,CASE
 WHEN already_replayed AND NOT source_unmodified THEN 'CONFLICT_SOURCE_CHANGED'
 WHEN already_replayed THEN 'RETURN_EXISTING'
 WHEN requested IS NULL OR requested<=0 THEN 'DENY_INVALID_QTY'
 WHEN NOT has_fg_receipt THEN 'DENY_MISSING_FG'
 WHEN NOT signed_route THEN 'DENY_UNSIGNED_FG'
 WHEN requested<=available THEN 'POST_PACK'
 WHEN signed_excess>0 AND NOT excess_authorized THEN 'DENY_EXCESS_AUTH'
 WHEN signed_excess>0 AND excess_authorized AND NOT excess_committed THEN 'DENY_EXCESS_NOT_COMMITTED'
 WHEN requested<=available+CASE WHEN excess_authorized AND excess_committed THEN signed_excess ELSE 0 END
      THEN 'POST_PACK_WITH_EXCESS'
 ELSE 'DENY_SHORT'
 END actual FROM scenarios
)
SELECT id,expected,actual,expected=actual AS pass FROM result ORDER BY id;
COMMIT;
-- In production the client CANNOT declare signed_route/excess_committed/already_replayed;
-- server must independently verify these under an appropriate batch/location lock.
-- Existing historical lines require idempotent C3 source-backed recovery; NEVER
-- silently create receipt or consume stock by mutating event_skus.

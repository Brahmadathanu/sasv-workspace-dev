create or replace view public.v_tally_fg_transfer_normalized as  WITH base AS (
         SELECT s.id,
            s.as_of_date,
            s.transfer_store,
            s.transfer_date,
            s.item_name,
            s.batch_code,
            s.qty_value,
            s.qty_unit_text,
            s.raw_godown,
            s.source_key,
            s.inserted_at,
            s.transfer_amount,
                CASE upper(TRIM(BOTH FROM s.transfer_store))
                    WHEN 'IK'::text THEN 'HO_IK'::text
                    WHEN 'OK'::text THEN 'HO_OK'::text
                    WHEN 'KKD'::text THEN 'KKD'::text
                    ELSE NULL::text
                END AS transfer_godown_code_norm,
            f_norm_key(s.item_name) AS item_alias_key_guess,
            f_norm_key(s.qty_unit_text) AS qty_unit_key_guess
           FROM app_private.mv_tally_fg_transfer_snapshot_latest s
        )
 SELECT b.id,
    b.as_of_date,
    b.transfer_date,
    b.batch_code,
    b.source_key,
    b.inserted_at,
    b.transfer_store AS transfer_store_raw,
    b.raw_godown AS raw_godown_raw,
    b.item_name AS item_name_raw,
    b.qty_value AS qty_value_raw,
    b.qty_unit_text AS qty_unit_text_raw,
    b.item_alias_key_guess,
    b.qty_unit_key_guess,
    b.transfer_godown_code_norm,
    g.id AS transfer_godown_id,
    g.code AS transfer_godown_code,
    g.name AS transfer_godown_name,
    g.region_id AS transfer_region_id,
    a.sku_id,
    a.alias_text AS matched_alias_text,
    a.alias_key AS matched_alias_key,
    a.note AS alias_note,
    a.created_at AS alias_created_at,
    v.product_id,
    v.item AS product_name,
    v.malayalam_name,
    v.status AS sku_status,
    v.is_active AS sku_is_active,
    v.uom_base,
    v.conversion_to_base,
    v.pack_size,
    v.uom AS sku_pack_uom,
    v.sku_label,
    COALESCE(v.uom, b.qty_unit_text) AS qty_unit_norm,
        CASE
            WHEN a.sku_id IS NULL THEN NULL::numeric
            WHEN v.uom_base IS NULL THEN NULL::numeric
            WHEN b.qty_unit_key_guess = ANY (ARRAY['btl','bottle','nos','no','pcs','piece','pack','pkt','box','jar','tin','tube','sachet','strip','unit','units']) AND EXISTS (SELECT 1 FROM costing.sku_base_quantity_exception x WHERE x.sku_id=a.sku_id AND x.product_id=v.product_id AND x.base_uom=v.uom_base AND x.approved_at IS NOT NULL AND x.sku_base_qty_per_unit>0) THEN b.qty_value*(SELECT x.sku_base_qty_per_unit FROM costing.sku_base_quantity_exception x WHERE x.sku_id=a.sku_id AND x.product_id=v.product_id AND x.base_uom=v.uom_base AND x.approved_at IS NOT NULL)
            WHEN v.pack_size IS NOT NULL AND v.conversion_to_base IS NOT NULL AND (b.qty_unit_key_guess = ANY (ARRAY['btl'::text, 'bottle'::text, 'nos'::text, 'no'::text, 'pcs'::text, 'piece'::text, 'pack'::text, 'pkt'::text, 'box'::text, 'jar'::text, 'tin'::text, 'tube'::text, 'sachet'::text, 'strip'::text, 'unit'::text, 'units'::text])) THEN b.qty_value * v.pack_size * v.conversion_to_base
            WHEN v.conversion_to_base IS NOT NULL AND v.uom IS NOT NULL AND f_norm_key(v.uom) = b.qty_unit_key_guess THEN b.qty_value * v.conversion_to_base
            WHEN v.uom_base IS NOT NULL AND f_norm_key(v.uom_base) = b.qty_unit_key_guess THEN b.qty_value
            ELSE NULL::numeric
        END AS qty_in_uom_base,
    v.uom_base AS qty_in_uom_base_unit,
    g.id IS NOT NULL AS is_godown_mapped,
    a.sku_id IS NOT NULL AS is_sku_mapped,
    b.transfer_amount AS transfer_amount_raw,
    round(b.transfer_amount, 2) AS transfer_amount,
        CASE
            WHEN b.transfer_amount IS NULL THEN NULL::numeric
            WHEN b.qty_value IS NULL OR b.qty_value = 0::numeric THEN NULL::numeric
            ELSE b.transfer_amount / b.qty_value
        END AS amount_per_unit_raw
   FROM base b
     LEFT JOIN godowns g ON g.code = b.transfer_godown_code_norm
     LEFT JOIN sku_aliases a ON a.alias_key = b.item_alias_key_guess
     LEFT JOIN v_sku_catalog_enriched v ON v.sku_id = a.sku_id;;
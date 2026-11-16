# WP10 — Product Group create contract blocker (2026-11-16)

Read-only live column/default inspection found `public.product_groups.kind_id integer NOT NULL` **without a database default**. Existing `js/product-groups.js` calls `insert([{ sub_category_id, group_name }])` and does not provide `kind_id`. Unless a BEFORE INSERT trigger fills this field, the existing UI create path cannot satisfy the live schema. Do **not** replicate the incomplete insert in a governed RPC.

Before authoring product-group CRUD, inspect live BEFORE INSERT triggers, `kind_id` FK/checks and existing rows/distribution; decide how kind is selected or derived, and independently verify the existing create flow. Avoid inventing a default or hardcoding a kind. This is a functional prerequisite to the four-level hierarchy rollout.

The previously staged subgroup RPC and client edits remain draft-only. No production changes or test claims. WP10 OPEN.

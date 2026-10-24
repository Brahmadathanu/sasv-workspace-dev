-- backfilled from live schema_migrations on 2026-10-24, CI-016
update inv_stock_item_class_map cm
set subcategory_id = 20
where cm.stock_item_id in (
  (select id from inv_stock_item where name='Nirgundyadi Erandam Soft Gel Capsule_4 Nos'),
  (select id from inv_stock_item where name='Vathamarmakan Capsule_4 Nos')
)
and cm.category_id=1
and cm.subcategory_id=18;
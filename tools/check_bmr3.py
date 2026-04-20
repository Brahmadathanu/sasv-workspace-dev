js = open('public/shared/js/manage-bmr.js', encoding='utf-8').read()
ok = True
for needle, label in [
    ('dedupByName',               'dedupByName helper'),
    ('resolveEligibleSubGroupIds','resolveEligibleSubGroupIds fn'),
    ('sgName =',                  'sgName from filterSubGroup'),
    ('sub_group_name === sgName', 'sg filter by name'),
    ('group_name === grpName',    'group filter by name'),
    ('subcategory_name === subName','subcat filter by name'),
]:
    found = needle in js
    print('OK  ' if found else 'MISS', label)
    if not found: ok = False

# Check that old ID-as-value is gone for sub-category at least
if '"id",\n    "subcategory_name"' not in js:
    print('OK   subcat no longer uses id as value')
else:
    print('BAD  subcat still uses id as value')
    ok = False

print()
print('ALL OK' if ok else 'ISSUES FOUND')

js   = open('public/shared/js/manage-bmr.js',  encoding='utf-8').read()
html = open('public/shared/manage-bmr.html',   encoding='utf-8').read()
ok = True

for needle, label in [
    ('c-uom-text',            'UOM span in addCreateRow'),
    ('span.dataset.uom',      'fillRowUom sets dataset.uom'),
    ('c-uom-empty',           'empty-state UOM class'),
    ('uomSpan.dataset.uom',   'getCreateRows reads span'),
    ('hierarchyData: {',      'hierarchyData in state'),
    ('state.hierarchyData = {','hierarchyData populated in loadHierarchyMap'),
    ('populateSubCategories', 'populateSubCategories fn'),
    ('populateGroups',        'populateGroups fn'),
    ('populateSubGroups',     'populateSubGroups fn'),
]:
    found = needle in js
    print('OK  ' if found else 'MISS', label)
    if not found: ok = False

for needle, label in [
    ('loadSubCategories',    'old loadSubCategories'),
    ('filterSubGroup.disabled','filterSubGroup.disabled'),
    ('filterGroup.disabled = true', 'filterGroup.disabled=true'),
]:
    found = needle in js
    print('OK   gone: ' + label if not found else 'BAD  still present: ' + label)
    if found: ok = False

for needle, label in [
    ('c-uom-text',  'UOM text CSS in HTML'),
    ('c-uom-empty', 'empty UOM CSS in HTML'),
]:
    found = needle in html
    print('OK  ' if found else 'MISS', label)
    if not found: ok = False

for needle, label in [
    ('filterSubCategory" disabled', 'filterSubCategory disabled attr'),
    ('filterGroup" disabled',       'filterGroup disabled attr'),
    ('filterSubGroup" disabled',    'filterSubGroup disabled attr'),
]:
    found = needle in html
    print('OK   gone: ' + label if not found else 'BAD  still present: ' + label)
    if found: ok = False

print()
print('ALL OK' if ok else 'ISSUES FOUND')

html = open('public/shared/manage-bmr.html', encoding='utf-8').read()
js   = open('public/shared/js/manage-bmr.js',   encoding='utf-8').read()
ok = True
checks = [
  ('hierarchyModal',            html, 'hierarchy modal in HTML'),
  ('openHierarchyModalBtn',     html, 'open hierarchy btn in HTML'),
  ('clearItemBnBtn',            html, 'clearItemBnBtn in HTML'),
  ('applyHierarchyBtn',         html, 'applyHierarchyBtn in HTML'),
  ('icon-btn--filter',          html, 'icon-btn--filter CSS in HTML'),
  ('explore-quick-row',         html, 'explore-quick-row CSS in HTML'),
  ('has-filter',                js,   'has-filter badge in JS'),
  ('clearItemBnBtn',            js,   'clearItemBnBtn in JS'),
  ('applyHierarchyBtn',         js,   'applyHierarchyBtn in JS'),
  ('hierarchyModal',            js,   'hierarchyModal in JS'),
  ('openHierarchyBtn',          js,   'openHierarchyBtn in JS'),
  ('updateHierarchyBadge',      js,   'updateHierarchyBadge fn in JS'),
]
for needle, src, label in checks:
    found = needle in src
    print('OK  ' if found else 'MISS', label)
    if not found: ok = False

# negative check
if 'loadExploreBns' not in js:
    print('OK   NO loadExploreBns remaining')
else:
    print('BAD  loadExploreBns still present in JS')
    ok = False

print()
print('ALL OK' if ok else 'ISSUES FOUND')

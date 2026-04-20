js   = open('public/shared/js/manage-bmr.js',   encoding='utf-8').read()
html = open('public/shared/manage-bmr.html', encoding='utf-8').read()
ok = True
checks = [
    # State
    ('managePg',              js,   'managePg in state'),
    ('explorePg',             js,   'explorePg in state'),
    # Els refs
    ('managePrevBtn',         js,   'managePrevBtn in els'),
    ('exploreNextBtn',        js,   'exploreNextBtn in els'),
    ('managePageSize',        js,   'managePageSize in els'),
    ('explorePageSize',       js,   'explorePageSize in els'),
    # Helper fns
    ('resetManagePg',         js,   'resetManagePg fn'),
    ('resetExplorePg',        js,   'resetExplorePg fn'),
    ('updateManagePager',     js,   'updateManagePager fn'),
    ('updateExplorePager',    js,   'updateExplorePager fn'),
    # Cursor logic
    ('cursor = null',         js,   'cursor param in render fns'),
    ('dataQ.lt("bmr_id", cursor)',js,   'Manage cursor lt'),
    ('dataQ.lt("id", cursor)',    js,   'Explorer cursor lt'),
    ('.limit(ps + 1)',        js,   'fetch ps+1 rows'),
    ('nextCursor',            js,   'nextCursor tracking'),
    # HTML pager elements
    ('managePrevBtn',         html, 'managePrevBtn in HTML'),
    ('manageNextBtn',         html, 'manageNextBtn in HTML'),
    ('managePageInfo',        html, 'managePageInfo in HTML'),
    ('managePageSize',        html, 'managePageSize in HTML'),
    ('explorePrevBtn',        html, 'explorePrevBtn in HTML'),
    ('exploreNextBtn',        html, 'exploreNextBtn in HTML'),
    ('explorePageInfo',       html, 'explorePageInfo in HTML'),
    ('explorePageSize',       html, 'explorePageSize in HTML'),
    # CSS
    ('pager-row',             html, 'pager-row CSS'),
    ('pager-info',            html, 'pager-info CSS'),
    # Negative: old fetch-all loop gone
]
for needle, src, label in checks:
    found = needle in src
    print('OK  ' if found else 'MISS', label)
    if not found: ok = False

# Old loop must be gone from both render fns
for old in ['while (keepFetching)', '.range(from, from + PAGE - 1)']:
    if old not in js:
        print('OK   gone:', old)
    else:
        print('BAD  still present:', old)
        ok = False

print()
print('ALL OK' if ok else 'ISSUES FOUND')

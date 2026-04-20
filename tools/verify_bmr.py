html = open('public/shared/manage-bmr.html', encoding='utf-8').read()
js   = open('public/shared/js/manage-bmr.js',  encoding='utf-8').read()
ok   = True

checks = [
    (html, 'Manage Batch Manufacturing Record', 'header title updated'),
    (html, '1.35rem',                           'h1 font-size 1.35rem'),
    (html, 'rgba(37, 99, 235, 0.05)',           'lens-pills gradient bg'),
    (html, '0 4px 14px rgba(37, 99, 235, 0.22)','active tab shadow'),
    (js,   'activeTab: "explore"',              'default activeTab=explore'),
    (js,   '"explore", "manage", "add"',        'tab priority order in JS'),
]
for src, needle, label in checks:
    if needle in src:
        print('OK  ', label)
    else:
        print('MISS', label)
        ok = False

# Tab DOM order
ix_e = html.find('data-tab="explore"')
ix_m = html.find('data-tab="manage"')
ix_a = html.find('data-tab="add"')
if ix_e < ix_m < ix_a:
    print('OK   tab DOM order: explore -> manage -> add')
else:
    print('BAD  tab DOM order:', ix_e, ix_m, ix_a)
    ok = False

# Header text
if 'Manage Batch Manufacturing Record' in html:
    print('OK   full header text present')
else:
    print('MISS full header text')
    ok = False

print()
print('ALL OK' if ok else 'ISSUES FOUND')

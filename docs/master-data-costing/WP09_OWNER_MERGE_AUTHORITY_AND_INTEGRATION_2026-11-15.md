# WP09 owner merge authority and integration — 15 November 2026

Owner replied **“I approve and go ahead”** to the concrete #434 merge → #437 retarget/diff/check → default-off merge sequence, acknowledging that the normal hosting pipeline may run. This supersedes earlier implementation-only/no-merge authority in the bounded scope. It does not authorise flag activation, SQL, registry/permissions, Electron repointing or formal closure.

#434 merged normally at `93dee941621faa8500e7833376a922f5f90216c1`. #437 retargeted to main; seven runtime files remain, no protected SQL changes. Inspection of CI found integrated-pec failing only because its static scope guard rejected the owner-reviewed `public/sw.js` change. Other tests in that job passed through the browser suites. No PEC application issue was identified or reopened.

A narrow integration correction adds a separate exact path/head/LF-SHA256 pin for that already-reviewed SW file: `a1b35dc2bf7bd9bd9f166f356b3d4cabed9340401e09a5d74da7480d269066b9`, only on `claude/wp09-g2-launcher-families`. Existing pins are preserved. New 9/9 tests prove exact acceptance and rejection for mutated/unreadable/no-context/wrong-head/new-SQL cases; existing guard suite remains 60/60 PASS. No general guard bypass and no migration edit.

#437 merge awaits refreshed CI at the pin correction; final merged main and hosting status will be recorded after integration. WP09 remains OPEN, programme 9/13. All live-role/PWA/Electron/Windows/hosted resolver/SW lifecycle obligations and WP11 defects remain as recorded. Five historical migration CRLF worktree differences are untouched.

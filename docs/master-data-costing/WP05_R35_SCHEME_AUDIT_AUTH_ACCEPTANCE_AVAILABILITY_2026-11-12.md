# WP05 R35 — Scheme Master audit authenticated acceptance: non-identifying account availability (12 Nov 2026)

**STATE: PRE-ACCEPTANCE READINESS VERIFIED, REAL AUTHENTICATED BEHAVIOUR NOT TESTED.** Owner authorised proceeding with narrowly controlled read-only acceptance after the Option A production one-view change (R34). No actual staff session or test user's browser was available through the connected Supabase/GitHub tools. In particular, the connected Supabase SQL interface executes as database administration context and is NOT a substitute for a normal user's signed-in access. No account credentials, token signing, JWT impersonation, user permission edits, auth provisioning, audit-history row reads or role grants were used.

## Live post-change view state

R34 post-DDL metadata verified live `public.v_costing_scheme_master_audit` matches the exact approved new definition MD5 `e2b9eb3c1b86d073183cd376f704cf58`, unchanged 20 columns, original postgres owner/ACL/comment, authenticated SQL SELECT present, anon and service_role SQL SELECT denied. Shared permission functions and other five D-2 view definitions unchanged. The database *definition* correction is verified, but no role-specific real authenticated JWT results are established by those checks.

## Read-only, non-identifying role-availability aggregation

Using `public.user_permissions_canonical` **aggregated by user_id internally only**, with no user identifiers, names, emails or audit rows returned, for the exact canonical module targets: `module:pricing-policy-manager`, `module:costing-control-center`, `module:cost-build-manager`, `module:cost-sheet-review`, `module:material-cost-manager`.

| Recorded permission combination | Aggregate count |
|---|---:|
| PPM View TRUE, none of four Costing View TRUE | **1** |
| PPM View TRUE and at least one of four Costing View TRUE | **3** |
| At least one of four Costing View TRUE, PPM View NOT TRUE | **0** |
| PPM Edit TRUE without PPM View TRUE | **0** |

These are counts of permission-record groups, **not proof of active/non-disabled user sessions**; no auth-user table was joined. They do not prove actual live responses or whether the user opens the screen through an authorised route.

**Important result:** A positive PPM-only class appears represented, and three mixed PPM+Costing users appear represented, but **no Costing-only positive View user without PPM View currently exists in these permission records**. The requested negative *Costing-only* acceptance cannot be carried out using an existing account of that exact category based on this inventory. Do not create a fictitious PASS or grant/revoke someone's permissions merely to manufacture a role matrix.

## No-row-export acceptance protocol, when an authorised existing session is available

- **Positive PPM-only:** An existing PPM View-only account, used by its legitimate authorised user, opens Pricing Policy Manager → Scheme Master → History. Record only whether the request to `v_costing_scheme_master_audit` completes and whether actual authorised history is available; only a YES/NO or zero/nonzero, no row contents, UUIDs, names, reason/approval remarks, screenshots of private history, or credentials. A zero-row history for a scheme is **not** proof of denial or access, so choose a known existing-history scheme under approved privacy constraints or use a safely authorised aggregate response.
- **Positive mixed:** Optionally repeat with one existing PPM+Costing View user; verify no inadvertent denial due to other module permissions.
- **Negative Costing-only:** Currently **NOT TESTABLE with a confirmed existing category** (aggregate count zero). Accept a future existing account naturally possessing that exact role, or conduct a separately approved isolated synthetic PostgreSQL test (already passed 10/10, not a production JWT proof). Do **not** add or alter privileges solely to test without new explicit owner authorisation.
- **Unauthenticated:** The catalogue already verifies `anon` has no SQL SELECT, but that is not a captured browser anonymous read attempt.
- All acceptance observations must differentiate `HTTP 200 + []` caused by the view's deny-where predicate from a permitted query returning no rows. Record the actual signed-in module permissions/role labels with no personal identifiers.
- Do not use Supabase administrative SQL `SET ROLE authenticated` with fabricated/existing `request.jwt.claim.sub` to claim a **real-session** result. Do not use service_role keys or admin APIs to fake an authenticated user.

## Retained gates

- **R28 Option A policy APPROVED; R34 production one-view DDL and catalogue postchecks PASS.**
- **R35 existing permission category inventory COMPLETE**, no actual browser/REST logged-in role session obtained.
- **Real signed-in positive PPM-only:** **NOT TESTED**.
- **Real signed-in Costing-only negative:** **NOT TESTED; no matching pre-existing canonical permission combination**.
- Other five D-2 view reader policies remain unapproved/unverified; W5-06 **OPEN**; frozen AE1 counts and D-1/D-4 limitations unchanged; formal WP05 **6/13**.

Next action: arrange one normal existing PPM View-only authorised browser acceptance observation, collecting only a status/existence signal, and retain the negative role test as **NOT TESTED** until suitable authorised evidence is available. This is an evidence-collection step, not an invitation to weaken permissions.

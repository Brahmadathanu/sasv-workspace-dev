# PEC S5 UX-F1 — IND Create Draft PR trigger layout (issue #511), v6.4.1

**Client/release only.** No Supabase, server calculation, RPC, migration, purchasing record or earlier release is changed.

## Root cause (verified)
`body.sasv-pec .icon-btn { width: var(--sasv-control-md, 36px) }` (specificity 0,2,1) outranks `.icon-btn.with-label { width: auto }` (0,2,0), and the shared `has-action-label` rescue is not applied to `with-label` buttons. The IND trigger therefore stayed 36px wide and its text wrapped letter-by-letter and overlapped the Notes label (reproduced: `evidence/uxf1-20261123/defect-reproduced-*.png`).

## Fix
A dedicated `.pec-ind-plan-trigger` (scoped under `#prPlanMethodRow`): `display:flex; width:100%; min-width:0; box-sizing:border-box; height:auto`, label wraps with `overflow-wrap:anywhere`, optional clipboard and chevron icons, visible `:focus-visible`, `[hidden]` honoured. It does **not** use `.icon-btn`, so no global override or reset was added. Label: **Manage IND planned requirements**. IND plan helper shortened to the approved text; the hybrid helper keeps the higher-of / never-summed explanation. Preserved: `#btnIndPlanEditor`, `aria-controls`, hidden-until-IND, handlers and the editor modal lifecycle.

## Verification (synthetic browser harness)
320 / 390 / 768 / 1440px and a 390×480 short viewport; IND plan and hybrid; RM Normal, RM JIT and PM (trigger hidden); long German/Spanish labels; keyboard Tab with a visible focus ring; Escape from the nested editor returns focus to the trigger; accessible name equals the visible label and is exposed once; no horizontal overflow; help → trigger → Notes separated; footer visible/reachable. Mutation: restoring the original `icon-btn with-label secondary` markup fails the fill/line-count/overlap/name gates (36px trigger, 28 label lines). Static assertions pin the class, rule and text.

## NOT TESTED
Signed-in production UI acceptance and an installed Windows update. The installer is unsigned.

# SASV Workspace design tokens & theme architecture

## Layer model

```
Foundation palette / structure
        ↓
Semantic UI tokens  (purpose-based)
        ↓
Theme profile assignment  (e.g. sasv-core)
        ↓
Components / modules  (consume semantic tokens)
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Foundation | [`design-tokens.css`](./design-tokens.css) | Raw colour scales, neutrals, status palette, typography/spacing/radius/shadow/z-index |
| Semantic defaults | same file (`:root`) | Purpose tokens (`--sasv-action-*`, surfaces, text, controls…) defaulting to **sasv-core** |
| Theme profile | [`themes/sasv-core.css`](./themes/sasv-core.css) | Explicit `html[data-sasv-theme="sasv-core"]` semantic → foundation map |
| Compatibility | [`style.css`](./style.css) | Legacy `--primary`, `--btn-bg`, … → **semantic** tokens |

## Rules

1. **Components consume semantic tokens** (`--sasv-action-primary`, `--sasv-surface`, `--sasv-control-border`, …), not raw scale steps (`--sasv-primary-600`, palette blues).
2. **New / derived themes must not redefine component CSS.** They only reassign semantic variables under a new `data-sasv-theme` value.
3. **Defaults work without JS and without `data-sasv-theme`.** `:root` semantic defaults equal sasv-core.
4. **Operational UI is light-only** for this gate (no OS dark auto-activation, no user theme picker, no preference storage).
5. Status colours (success / warning / danger / info) stay independent of brand identity.

## Theme selector contract

```html
<html data-sasv-theme="sasv-core">
```

Login and Home set this attribute. Other pages inherit sasv-core via `:root` defaults until migrated.

## Foundation tokens (examples)

- Teal scale: `--sasv-primary-50` … `--sasv-primary-900`
- Neutrals: `--sasv-neutral-0` … `--sasv-neutral-800`
- Status palette: `--sasv-palette-success*`, `--sasv-palette-warning*`, …
- Gold (sparse): `--sasv-gold-*`
- Compat blues (temporary): `--sasv-compat-blue-*`
- Structure: `--sasv-font-*`, `--sasv-space-*`, `--sasv-radius-*`, `--sasv-shadow-*`, `--sasv-control-sm|md|lg`, `--sasv-z-*`
- Typography: locally bundled **Inter** via [`sasv-fonts.css`](./sasv-fonts.css) + [`../fonts/`](../fonts/); `--sasv-font-sans` = `"Inter", "Segoe UI", Roboto, Arial, sans-serif`

## Semantic tokens (examples)

| Purpose | Tokens |
|---------|--------|
| Surfaces | `--sasv-bg`, `--sasv-surface`, `--sasv-surface-soft`, `--sasv-surface-elevated` |
| Text | `--sasv-text`, `--sasv-text-secondary`, `--sasv-text-muted`, `--sasv-text-on-primary` |
| Actions | `--sasv-action-primary` (+ hover/active/soft), `--sasv-action-secondary` (+ hover), `--sasv-action-home` |
| Links / selection | `--sasv-link`, `--sasv-link-hover`, `--sasv-selection`, `--sasv-selection-soft` |
| Focus | `--sasv-focus-ring`, `--sasv-focus-ring-strong` |
| Controls | `--sasv-control-bg`, `--sasv-control-border`, `--sasv-control-border-hover`, `--sasv-control-border-focus` |
| Status | `--sasv-success*`, `--sasv-warning*`, `--sasv-danger*`, `--sasv-info*` |
| Section families | `--sasv-section-<family>-fg\|bg\|border` (`ops`, `plan`, `procure`, `inventory`, `finance`, `quality`, `report`, `admin`, `general`) |
| Home command dock | `--sasv-home-command-bg\|fg\|border\|meta-*\|chip-bg` |

Phase 1/2 shorthands (`--sasv-primary`, `--sasv-home`) alias to action semantics for Login/Home equivalence; prefer `--sasv-action-*` in new work.

Home maps section classes (`.section-identity-*`) → `--identity-*` locals from the section-family tokens above. Future themes reassign those semantic tokens only.

## Compatibility aliases (`style.css`)

Prefer: **legacy → semantic → theme**

| Legacy | Resolves via |
|--------|----------------|
| `--primary` / `--primary-hover` | `--sasv-action-primary*` |
| `--btn-bg` / `--btn-hover-bg` / `--btn-text` | action primary + on-primary text |
| `--btn-bg-light` | `--sasv-compat-blue-3b82f6` (temporary until Phase 3) |
| `--bg-color` / `--panel-bg` / `--text-color` / `--muted` | surface / text semantics |
| `--home-btn-bg*` | `--sasv-action-home*` |
| `--clear-btn-bg*` | muted / secondary text |

## Future user-selectable profiles

1. Add `themes/<profile-id>.css` with `html[data-sasv-theme="<profile-id>"] { …semantic assignments… }`.
2. Import it from `style.css` (or a themes bundle).
3. Set `data-sasv-theme` from a future settings UI / local preference (not implemented now).
4. Components need no CSS changes if they already use semantic tokens.

## Shared component primitives

| Gate | File | Contents |
|------|------|----------|
| 3A | [`style.css`](./style.css) | Buttons, toast |
| 3A | [`../js/ui-icons.js`](../js/ui-icons.js) | Action icons |
| 3B | [`sasv-primitives.css`](./sasv-primitives.css) | Toolbars/filters, chips, modal, drawer, pager, form controls, Tom Select skin |

Components must use semantic tokens from this document. Theme profiles only reassign those tokens.

## Usage

```css
/* Preferred */
background: var(--sasv-action-primary);
color: var(--sasv-text-on-primary);
border-color: var(--sasv-control-border-focus);

/* Avoid in components */
background: var(--sasv-primary-600);
background: #147a6c;
```

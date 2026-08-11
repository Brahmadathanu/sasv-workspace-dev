# SASV Workspace theme profiles

## Contract

```html
<html data-sasv-theme="sasv-core">
```

Profiles live in this folder and **only assign semantic tokens** to foundation palette values.

| File | Profile id |
|------|------------|
| [`sasv-core.css`](./sasv-core.css) | `sasv-core` (current approved) |

## Rules

1. Do not redefine component CSS in theme files.
2. Defaults for `sasv-core` also exist on `:root` in `../design-tokens.css`, so pages without `data-sasv-theme` still resolve correctly (no JS).
3. To add a profile later: copy `sasv-core.css`, change the selector and semantic assignments, then set `data-sasv-theme` (or a future user preference) to the new id.

See [`../DESIGN_TOKENS.md`](../DESIGN_TOKENS.md) for the full token architecture.

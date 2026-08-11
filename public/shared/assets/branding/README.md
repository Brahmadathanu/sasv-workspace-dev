# SASV Workspace branding assets

## Canonical source

`source/sasv-workspace-icon-master.png`

This is the only approved master artwork. Runtime code must never reference this file.

## Generation

From the repository root:

```bash
npm run branding:generate
```

Or:

```bash
node tools/generate-branding-assets.js
```

The generator only clears outside-canvas pixels (so the dark-green rounded tile remains), letterboxes the full artwork into a square (transparent pad only — no crop/distort), then resizes/packs. It does not redraw or recolour the mark.

## Generated size matrix (`derived/`)

| File | Size |
|------|------|
| `favicon.ico` | multi-resolution ICO (16–256) |
| `favicon-16.png` | 16×16 |
| `favicon-32.png` | 32×32 |
| `icon-48.png` | 48×48 |
| `icon-72.png` | 72×72 |
| `icon-96.png` | 96×96 |
| `icon-128.png` | 128×128 |
| `icon-144.png` | 144×144 |
| `icon-152.png` | 152×152 |
| `apple-touch-icon-180.png` | 180×180 |
| `icon-192.png` | 192×192 |
| `icon-256.png` | 256×256 |
| `icon-384.png` | 384×384 |
| `icon-512.png` | 512×512 |
| `app-mark-512.png` | 512×512 (UI shell / splash) |

`derived/platform/` is reserved for future macOS/Linux packaging icons.

## Runtime consumers

- Electron window + installer: `derived/favicon.ico` (`main.js`, `package.json` `build.win.icon`)
- Login / home shell: `derived/app-mark-512.png`
- Browser entry favicons: `derived/favicon.ico`, `apple-touch-icon-180.png`, `icon-192.png`
- Utilities Hub PWA manifest + connected pages: `derived/icon-*.png`
- Service worker precache: same `derived/` icon URLs

## Rules

- Edit or replace only `source/sasv-workspace-icon-master.png`, then regenerate.
- Do not hand-edit files under `derived/`.
- Organization letterhead (`public/shared/assets/santhigiri-logo.png`) is independent and is not part of this tree.

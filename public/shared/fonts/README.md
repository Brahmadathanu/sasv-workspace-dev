# SASV Workspace fonts

## Inter (primary UI)

Locally bundled Inter (latin, weights 400/500/600/700) under `inter/`.

- Declared in [`../css/sasv-fonts.css`](../css/sasv-fonts.css)
- Consumed via `--sasv-font-sans` in [`../css/design-tokens.css`](../css/design-tokens.css)
- Imported globally from [`../css/style.css`](../css/style.css) (no CDN at runtime)

Fallback stack: `"Inter", "Segoe UI", Roboto, Arial, sans-serif`

To refresh files, re-download latin woff2 weights from Fontsource Inter and replace the files in `inter/`.

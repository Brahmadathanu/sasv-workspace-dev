# SASV Workspace (daily-worklog-app)

Electron + PWA ERP client for Santhigiri Ayurveda Siddha Vaidyasala.

- **Live Supabase** is authoritative for database/server contracts; repository SQL is not deployment truth.
- Regenerate client types: `npm run sync-db` (requires a linked Supabase CLI project).
- Historical SQL evidence lives under `docs/archive/sql/` — do not execute archived SQL as live schema.
- Development smokes and helpers live under `scripts/` and `tools/` (not packaged into Electron installers).

Local app: `npm start` / `npm run dev`. Production build: `npm run build`.

# Tucoloc

French-only PWA for one Flatshare of three Flatmates: Room Occupancy, Expenses, Recipes and Meal. Domain language in `GLOSSARY.md`, decisions in `docs/adr/`.

## Commands

- `npm run dev`: local dev server (needs `.env`, see `.env.example`)
- `npm test`: Vitest suite
- `npm run typecheck`: TypeScript check
- `npm run build`: typecheck + production build
- `scripts/setup-wizard.sh`: one-time human setup (Supabase project, accounts, Vercel). Run from the repo root.

Deploy: Vercel builds `main` on every push. Database changes: SQL files in `supabase/migrations/`, run by hand in the Supabase SQL Editor.

## Architecture

- All server access goes through the `Backend` interface (`src/backend/Backend.ts`): `SupabaseBackend` in production, `InMemoryBackend` in tests. UI code never imports Supabase.
- Live updates: `Backend.subscribe` reports a changed `Topic`; components read data through `useLive`, which reloads on that topic.
- Time comes from the injected `Clock`, never `new Date()` in features.
- PWA: `public/manifest.webmanifest` and `public/sw.js` (installability only, no caching). Icons come from a 512×512 logo (`icon-512.png`): `icon-192` and `apple-touch-icon` (180) are resizes; `icon-maskable-512` is the logo at 80% on a yellow→orange gradient so Android's mask doesn't crop it.
- Tests render the real `App` over `InMemoryBackend` and a controllable `Clock` (see `test/render.tsx`) and assert on what a Flatmate sees. No other test seam.

## Definition of Done

- Update this CLAUDE.md if conventions, architecture, or commands change
- Update unit tests to cover new or changed behavior

## Agent skills

### Issue tracker

GitHub Issues on `eliottlebot/tucoloc`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

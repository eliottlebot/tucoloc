# Tucoloc

French-only PWA for one Flatshare of three Flatmates: Room Occupancy, Expenses, Recipes and Meal, and the Shopping List. Domain language in `GLOSSARY.md`, decisions in `docs/adr/`.

## Commands

- `npm run dev`: local dev server (needs `.env`, see `.env.example`)
- `npm test`: Vitest suite
- `npm run typecheck`: TypeScript check
- `npm run build`: typecheck + production build
- `scripts/setup-wizard.sh`: one-time human setup (Supabase project, accounts, Vercel). Run from the repo root.

Deploy: Vercel builds `main` on every push. Database changes: SQL files in `supabase/migrations/`, run by hand in the Supabase SQL Editor.

## Architecture

- All server access goes through the `Backend` interface (`src/backend/Backend.ts`): `SupabaseBackend` in production, `InMemoryBackend` in tests. UI code never imports Supabase.
- No connection: a Backend call that gets no answer throws `ConnectionError`. `App` wraps the Backend in `watchConnection`, which turns that into the offline overlay (with a sad or pissed Tuco drawn at random; the pictures in `src/assets/` are inlined in the bundle with `?inline`, so they show without connection) and a call that never settles, so features need no error handling for it. Other errors pass through. In tests, `backend.goOffline()` / `goOnline()`.
- Live updates: `Backend.subscribe` reports a changed `Topic`; components read data through `useLive`, which reloads on that topic.
- Time comes from the injected `Clock`, never `new Date()` or `setTimeout` in features: `clock.now()` reads it, `clock.at(time, callback)` waits for it. In tests, `testClock(start).advance(ms)` moves time and runs what falls due (wrap in `act`).
- Recipe photos: private Storage bucket `recipe-photos`. A Recipe stores the photo's path; `listRecipes` returns signed links (30 days), renewed on every reload.
- Design: [Figma mockups](https://www.figma.com/design/b6r9qOJCQeX0PYp5DZXy8Q/Life?node-id=7-2). Tokens (colors, radius, fonts) and shared styles in `src/styles.css`; icons from the mockups in `src/icons.tsx`; logo `public/logo.png`. Fonts: Outfit Bold (`--font-weight: 700`) for fields, labels, buttons and card text; BBH Hegarty (`--font-display`) for big and medium titles, the yellow titles in cards, the Recipe form's field names, and the Tricount figures (balances; an Expense's label and amount, date, payer; amounts in transfers and Settlements, `.price`). Tests find a sentence with an amount inside through `sentence()` (`test/render.tsx`). Screens: home (opens first: tonight's Meal, or "Aucun plat choisi", and the Rooms, `src/HomeScreen.tsx`), Tricount, Recettes and Courses (Shopping List). Bottom bar: Accueil (house), Tricount, Recettes, Courses; the header (logo + name) also goes home. In the Shopping List, tapping an Item's name marks it bought; tapping again puts it back to buy.
- No accents: BBH Hegarty (the titles' font) has no accented letters (nor `«»`, `œ`). Interface text is written without accents; what a Flatmate types goes through `plain` (`src/plain.ts`) before it is saved; dates the app writes out too. Existing data was converted once (`0009_unaccent.sql`); a Flatmate added later in the Supabase dashboard must be named without accents.
- Every delete, and recording a Settlement, asks first through the shared `ConfirmDialog` (`src/ConfirmDialog.tsx`). Exception: a Shopping List Item is deleted at once (clearing the bought Items does ask).
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

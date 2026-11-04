# Tucoloc

French-only PWA for one Flatshare of three Flatmates: Room Occupancy, Expenses, Recipes and Meal. Domain language in `GLOSSARY.md`, decisions in `docs/adr/`.

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

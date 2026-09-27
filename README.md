# Pluggappen (studieapp)

A study PWA for university courses. React + Vite + TypeScript, Dexie (IndexedDB), ts-fsrs. No backend; all progress stays on the device.

- `npm run dev`: dev server (with a "Ladda exempelkurs" button that loads the made-up sample in `dev/`)
- `npm test`: Vitest
- `npm run build`: type-check and production build

Course content is not part of this repo. It is imported in the app ("Inställningar → Importera kurs") from a JSON bundle in the format described in `src/content/schema.ts`. See `CLAUDE.md`, `docs/PLAN.md` and `docs/HANDOFF.md`.

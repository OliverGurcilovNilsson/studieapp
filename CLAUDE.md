# Studieapp

A study app for university courses (first course: 3FS075 Farmakoepidemiologi och farmakoekonomi). It is a PWA hosted on GitHub Pages, and the repo is public.

## Hard rules
- **No course material in the repo.** No PDFs, exam text or real questions. Course content lives outside the repo (`~/Downloads/Farmakoepidemiologi/content/*.json`) and gets into the app through the in-app JSON import. Tests use made-up sample data only.
- **No backend.** All data is in IndexedDB through Dexie (`src/db/`).
- **Never lose user data.** Every Dexie schema change bumps the version, adds a migration and adds a migration test. Never clear tables on upgrade.
- **Content and progress are separate.** Re-importing a course must keep `reviewStates` and `reviewLog`, which are keyed by question id.
- **AI is optional.** Studying must work fully offline without an API key. The API key is stored only in local settings. Render AI output as plain text, never with `dangerouslySetInnerHTML`.
- **Answer provenance:** `official` answers are authoritative. A `student` answer is only trusted when `awarded === max`. See `hasTrustedAnswer`.

## Conventions
- The UI copy is in **Swedish**. Code and comments are in English.
- Responsive: phone layout with bottom nav, and a sidebar layout from 900px. Desktop keyboard shortcuts: 1–4 to rate, A–D for MCQ, Space to reveal, Enter for next.
- Styling is plain CSS with tokens in `src/styles/tokens.css`. The visual design follows the approved mockups: periwinkle #A9ADF0, yellow #F2C84B, ink #111114, Bricolage Grotesque for display text, Figtree for body text.
- Keep scheduling and scoring logic as pure functions in `src/lib/`, with Vitest tests next to them (`*.test.ts`).
- Keep dependencies few. Ask before adding one.

## Commands
- `npm run dev`: dev server
- `npm test`: Vitest
- `npm run build`: type-check and production build

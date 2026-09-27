# Handoff: continue building Studieapp

Read first: `CLAUDE.md` (hard rules), `docs/PLAN.md` (the full spec) and `docs/mockups/*.dc.html` (the approved visual design; open them as plain HTML, the markup is inline-styled).

## Hard constraints for cloud sessions
- **There is no course content here, and there never will be.** Real exams and PDFs stay on the owner's Mac. Develop and test only with a **made-up** sample course (task 1). Never try to fetch or recreate real exam content.
- Content format: `src/content/schema.ts`. The real bundle (`3fs075.json`) is produced locally by `npm run content` from extracted parts, then imported in the app with "Importera kurs".
- UI copy is Swedish, code is English. Keep dependencies few; the approved set is already in package.json.
- Run `npm test` and `npm run build` before every commit. Commit in small steps with clear messages.

## State when handed off (2026-09-27)
Done and tested (31 tests):
- `src/db/db.ts`: Dexie schema v1. Content is keyed `[courseId+id]`; progress (`reviewStates`, `reviewLog`) is kept across re-imports.
- `src/db/importCourse.ts`: parse + import, with tests.
- `src/lib/scoring.ts`: numeric check with strict rounding (`decimals`), multi-select with negative marking.
- `src/lib/scheduler.ts`: ts-fsrs wrapper; the guessed flag counts as Hard; nothing is due later than the day before the exam; retrievability.
- `src/lib/session.ts`: queue (due first, then new interleaved by topic; exam mode keeps paper order).
- `src/data/queries.ts`, `src/lib/topics.ts`, `src/styles/tokens.css` + `app.css`, `src/ui/{Shell,icons,useAsync}`.
- Pages written but **not yet routed or styled completely**: `src/pages/Library.tsx`, `src/pages/Course.tsx`.
- Practice components written: `src/practice/{RichText,AnswerPanel,useAssetUrl}`.
- `scripts/build-content.ts`: merges parts, with source priority and validation. Runs locally only.

`src/main.tsx` / `App.tsx` are still the Vite template. **The app does not show the new pages yet.**

## Task list (in order; tick them off in this file as you go)
1. [x] **Sample course** `dev/sample-course.json`: made-up content in the bundle format covering every question type (mcq, mcq_multi with negativeMarking, calculation with decimals, free_text with official, student (full and partial) and own_notes answers, one with no trusted answer, flashcard, article_review), 2 fake exams, 1 fake PNG asset. Add a "Ladda exempelkurs" button in dev builds only.
   - Done: `dev/sample-course.json` (course id `exempel`, 18 made-up questions, exams `2025-01-17` and `2025-06-05`, a generated PNG chart and a tiny fake article PDF). Regenerate with `node dev/make-sample.mjs dev/sample-course.json`. `src/dev/sampleCourse.test.ts` checks type coverage and that every reference resolves. The button (`src/dev/SampleButton.tsx`) is rendered only behind `import.meta.env.DEV`.
2. [x] **Routing** (HashRouter, for GitHub Pages): `/` Library, `/kurs/:courseId` Course, `/ova/:courseId?amne=&tenta=` Practice, `/installningar` Settings. Replace the Vite template (delete App.tsx/App.css/assets). Add the Google Fonts link (Bricolage Grotesque 500/700/800, Figtree 400–700) to index.html, and set `lang="sv"` and the title "Pluggappen".
   - Done: `src/routes.tsx`. `/ova/:courseId` is full screen outside the Shell (the mockups show no nav while practising). `/ova` (the nav tab) goes straight to the only course, or lists courses when there are several. Favicon is the mascot; README replaced.
3. [ ] **Practice page** (`src/pages/Practice.tsx` + `src/practice/*`), matching mockups 3–6:
   - Header: close, "n / N", progress bar, topic · type · points label.
   - Players: MCQ (A–D, instant feedback, "Säker / Gissade" toggle, `review(..., {guessed})`), mcq_multi (checkboxes, `scoreMulti`), calculation (input, `checkNumeric`, a separate "fel avrundning" message, `numeric.solution` shown as "Lösningsgång"), free_text / article_review / flashcard (textarea, then "Visa facit", then `AnswerPanel`).
   - Context via `RichText` (supports pipe tables); figures via `useAssetUrl`; for an article, a link to open the article PDF.
   - Rating bar Igen / Svår / Bra / Lätt with `previewIntervals` labels. On rating: save `reviewStates` and `reviewLog` with `db.transaction`, then go to the next question.
   - Keyboard (desktop): 1–4 rate, A–D choose, Space reveal (not while typing), Enter next, Cmd/Ctrl+Enter reveal from the textarea.
   - ≥900px: two columns for free text (question left, your answer + answer key right).
   - End screen (mockup 8 style): big numbers, correct / to review, and "Repetera missarna".
4. [ ] **Settings page**: "Importera kurs" (file input → `parseBundle` → `importCourse`, showing the result including `orphanedProgress`), exam date per course (setting `examDate:<courseId>`), minutes per day, theme (auto/light/dark via `data-theme`), "Exportera säkerhetskopia" (all tables to JSON) and "Återställ från säkerhetskopia" (progress tables only, confirming first), plus a weekly backup reminder. Call `navigator.storage.persist()` on first import.
5. [ ] **Styling pass** against the mockups for Library (tilted deck cards), Course (yellow hero card, tiles) and Practice; dark mode; phone width 390px, desktop ≥900px sidebar. Classes used in the pages that app.css does not define yet: `empty, deck-grid, deck, deck-badge, deck-title, deck-meta, deck-due, bar-on-accent, hero-card, on-accent, course-top, row-between, forecast, muted, small, count-bubble, section-title, topic-tile, topic-dot, thin, exam-list, exam-chip, answer*, badge-soft, badge-dashed, link-btn, grader, long, explanation, keypoints, mistakes, sub, answer-panel, table-wrap, rt-p`.
6. [ ] **Tentaläge** (plan: "Tentaläge"): `src/lib/examMode.ts`, pure and tested. It computes R_exam, topic weights from exam points (`points` per `topic` over questions with `examId`), gain per minute, pacing of new cards, and the forecast shown in points "Beräknad poäng X/50 → G/VG" using `course.examInfo`. Use it for the daily queue when an exam date is set.
7. [ ] **Tentasimulering**: pick an exam, timed (4 h, pausable), in paper order, auto-score the objective types, self-score the free text against keyPoints (0–max per question), and show a result screen with the total, per-part scores and G/VG thresholds.
8. [ ] **Täckningskarta** (mockup 7): per topic, the share mastered / seen / not started, and how many exams the topic appears on.
9. [ ] **Felbank**: questions with lapses ≥ 2 or most recently rated "Igen".
10. [ ] **PWA**: `vite-plugin-pwa` (autoUpdate + "Ny version – ladda om" banner), manifest (the mascot icon, Swedish name), offline caching including Google Fonts, `base` set for GitHub Pages.
11. [ ] **Deploy**: a GitHub Actions workflow that builds and deploys to Pages on push to main (runs `npm test` first).
12. [ ] **Dexie migration test harness**, ready for the first v2 schema change.

## Local-only work (on the owner's Mac, needs the PDFs; NOT for cloud)
- Extraction still to do: `notes-gamla-tentor` (her notes, AI-assisted), the article-review templates and PracticeArticles, the four unidentified student copies (`stu-40846970` may be 2022-02-18), and lectures → objectives. Brief: the `extract-course` skill.
- Open content decisions: 2026-02-20 q3a (Incidensrat or Kumulativ incidens?), q5b; the workshop diagrams need the original workshop instructions.
- Then: `npm run content -- ~/Downloads/Farmakoepidemiologi/content 3fs075` and import the result in the app.

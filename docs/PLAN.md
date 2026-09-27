# Study app, finalized plan: 3FS075 Farmakoepidemiologi och farmakoekonomi

## Context
This finalizes the earlier plan in `~/.claude/plans/i-want-to-create-frolicking-dongarra.md`. Changes from that plan:
- **Course:** it is pharmacoepidemiology and health economics (3FS075), not pharmacology. All material is in Swedish.
- **Who builds it:** Claude builds it, and you review each phase. The earlier plan had you writing the code.
- **Language:** the interface is in Swedish.
- **Deadline:** her exam is within weeks. The goal is a usable app early, with the AI upload pipeline pushed back.

The architecture from the earlier plan stays: a React + Vite + TS PWA on GitHub Pages, progress in IndexedDB (Dexie), content that is generic and data-driven, and content kept out of the public repo.

## Locked decisions
- **Stack:** Vite + React + TypeScript, React Router, Dexie, `ts-fsrs`, `vite-plugin-pwa`, Vitest. Plain CSS with tokens, dark mode included.
- **Repo:** new folder `~/Downloads/studieapp/` with git init. It holds code only. Course content lives in `~/Downloads/Farmakoepidemiologi/content/3fs075.json`, which is **not** in the repo. It is loaded into the app with the in-app "Importera kurs (JSON)" button. This avoids publishing exams on the public Pages site.
- **Question types:** `mcq` | `free_text` | `calculation` | `article_audit`. `calculation` is new. It covers numeric answers with a tolerance and units for DDD/1000 inv/dag, RR/OR/RD/NNT, incidence and prevalence, sensitivity/PPV, and ICER/QALY, plus a worked solution.
- **Answer provenance: official vs student answers.** A question can carry several answers, and each one records where it came from:
  - `official`: from the university's grading guide (Bedömningsvägledning). This is the authoritative answer.
  - `student`: an answer written by a previous student. It is stored with the points awarded (`awarded`/`max`) and any grader comments.
  - A student answer counts as **correct** only when `awarded === max`. Anything below full marks is shown as a **graded example** ("Studentsvar – 3/5 p"), never as the answer.
  - In the UI, the reveal step shows the official answer first when there is one, then the student examples sorted by score. This helps her see what a full-mark answer contains compared with a partial one.
  - In the Phase 3 AI feedback, the official guide is the rubric. Student answers are only calibration examples ("this earned 3/5").
  - If a question has no official answer and no full-mark student answer, it is flagged "Osäkert facit" (uncertain answer key). It gets lower priority in exam simulation, and the flag is shown in the coverage view.
- **Schema**, extended from the old plan:
  ```
  Course { id, name, lang, lectures[], objectives[] }
  Lecture { id, title, sourceFile }
  Objective { id, lectureId, text }
  Exam { id, date, sourceFiles[], kind: "official" | "student_copy" }
  Question { id, courseId, examId, objectiveIds[], number, type, points?,
             prompt, options?, correct?, numericAnswer?, tolerance?, unit?,
             keyPoints?[], articleText?, answers: Answer[] }
  Answer { provenance: "official" | "student", text, awarded?, max?,
           graderComments?, sourceFile }
  // derived: hasTrustedAnswer = some(official) || some(student && awarded === max)
  ReviewState { questionId, fsrs card fields, history[] }
  ```
- **Third provenance, `own_notes`:** her own seminar and workshop answers, labelled "Egna anteckningar". They are shown as a reference with a mild label, not the "Osäkert facit" warning. They are **not** trusted for "behärskad" or the exam forecast, and official answers are always shown first. When a question has a condensed version ("Kort svar till workshopen"), that becomes the main answer and the long version becomes "Utförlig förklaring".
- **Exam structure:** 50 p in total, G at 30 p, VG at 40 p. It covers concepts (epidemiology, health economics, public health, ethics) and ends with an **article review** of an unseen article that is provided in the exam. The exam simulation and the forecast use the real thresholds, e.g. "Beräknad poäng 36/50 → G".
- **Article review, "Artikelgranskning":**
  - A `ReviewTemplate` entity holds the standard checklist of about 21–24 questions from the seminar.
  - A `PracticeArticle` holds an article (the PDF stored in IndexedDB, bundled in the content file) plus answers for each checklist question: her seminar notes, or the official answers from a grading guide for past exam articles.
  - The practice view shows the article on the left and the checklist on the right (stacked on a phone). She writes an answer, then compares it with the reference.
  - General lessons from the seminar answers (for example the clues that reveal a study design, or how drop-outs affect validity) also become normal cards.
- **Workshops:** each a/b/c sub-question becomes a free-text practice question tagged to its topic, with `own_notes` answers. Diagrams the questions refer to are cropped from the PDF pages and bundled as images in the content file.
- **Grading rules from the grading guides:**
  - Calculation cards check the **rounding** separately. They state the required decimals, and "fel avrundning" counts as wrong even when the value is right.
  - Free-text key points include "vanliga misstag", because wrong statements cost points.
- **Source classification (first guess, to be checked in Phase 0):**
  - Likely official: the three `Bedömningsvägledning …` files, `Frågor tentamen 3FS075 1okt2025-2`, `Uppgifter tentamen 3FS085 20feb2026`, `3FS075 tentamen aug 2024 frågor`.
  - Likely student copies, possibly graded: the files named like downloads from a document-sharing site (`3fs075-…`, `40846970-…`, `…-vg…`, `omtenta-…-resultat-och-bedomning…`, `epidemiologi-…-2021`, `farmakoepidemiologi-tenta-…`).
  - Every file's classification goes into a `sources` table in the JSON for you to confirm. The duplicate `(kopia)` file is skipped.
- **Topics / objectives** come from the lecture PDFs: studiedesigner, förekomstmått, effektmått, bias & confounding, validitetsmått, DDD & läkemedelsanvändning, ATC, datakällor, följsamhet, etik, folkhälsa, hälsoekonomi. Topic weight comes from how often each topic shows up in past exams.

- **Responsive, desktop is a full target.** Her screen size decides the layout:
  - Phone: bottom navigation, one column.
  - From about 900px: a sidebar replaces the bottom nav, and the content is centered with a max width. Free-text and article audit screens use two columns, with the question or article on the left and her answer and the answer key on the right.
  - Keyboard shortcuts on desktop: `1–4` for the self-grade ratings, `A–D` for MCQ options, `Space` to reveal the answer, `Enter` for the next question.
- **Storage:** no backend. Everything is stored in IndexedDB through Dexie, in these tables: courses, lectures, objectives, exams, questions (multi-entry index on `*objectiveIds`), reviewStates, reviewLog, files, settings.
  - Content and progress are kept apart, so re-importing a course keeps her progress, which is linked by question id.
  - Every schema change needs a Dexie migration that has a test. The app makes an automatic backup before upgrading, and shows a "ny version – ladda om" banner when an update is available.
  - The app calls `navigator.storage.persist()` and reminds her to export a backup every week.
  - Supabase is the upgrade path only if sync between devices is ever needed.
- **Privacy:**
  - The repo's `.gitignore` covers `*.pdf`, `content/` and `*backup*.json`.
  - Tests use made-up sample data only.
  - Content reaches her device as a JSON file, via "Importera kurs".
- **AI safety and resilience (Phase 3):**
  - The API key is stored only in local settings, never in code.
  - The app gets its own Console workspace and key with a monthly spending limit.
  - AI output is always rendered as plain text, never with `dangerouslySetInnerHTML`.
  - Few dependencies, with the lockfile committed.
  - Errors show clear Swedish messages: 401 asks for the key again, 429/5xx retry with backoff, and a spending-limit error says so.
  - The model name is a setting.
  - Uploads save progress per chunk.
  - AI is never required for studying.
- **Upload pipeline** (Phase 0 runs it offline as a script; Phase 3 runs it in the app with the same prompts):
  1. pdf.js extracts text and thumbnails, and the PDF is split into chunks of about 15–20 slides.
  2. One call on the whole PDF produces an outline with slide ranges mapped to objectives.
  3. One call per chunk generates cards, using past exam questions for the same objectives as style examples. Each card includes slide references and an evidence quote.
  4. Automatic checks: the quote must exist in the slide text, calculation answers are recalculated with a math parser, and near-duplicates are removed.
  5. Review happens during study: a new card shows as "AI-genererad", and she approves it or reports a problem when she meets it.
- **Upload defaults** (my recommendations, open to change):
  - Only approved cards count towards "behärskad".
  - About one card per 1–2 content slides, weighted by how often the topic appears on exams.
  - Plain flashcards only for definitions. Everything else is exam-style (MCQ, calculation, free text).
- **Tentaläge, the exam-aware scheduler (Phase 2, replaces plain "due today"):**
  - She sets the exam date and her minutes per day.
  - For each card: R_exam = FSRS retrievability at the exam date.
  - Topic weight = the objective's share of points across past exams.
  - Daily queue: rank cards by `weight × (R_exam_after − R_exam_now) / estimated seconds per card` and fill her time budget.
  - No interval can go past the exam date. Every weighted card gets a final review in the last 1–3 days.
  - New cards are paced as (cards not yet started) ÷ (days left − 3); nothing new is introduced in the last 3 days.
  - The overview shows "Beräknad kunskap på tentadagen", the weighted mean of R_exam across all cards.
  - After the exam, the app goes back to normal FSRS.

## Step 0: Visual mockups (before any code)
Build one HTML Artifact with static phone-frame mockups in the style of the reference image you pasted. That means a periwinkle background (~#A9ADF0), warm yellow CTAs (~#F0C94A), bold black display type (e.g. Bricolage Grotesque / Archivo Black from Google Fonts), large rounded cards, chunky pill buttons, colored "deck" cards with a badge and a progress bar, big percentage numerals, and playful flat icons. It will use an original mascot, not a copy of the reference app's brand. All screen text is in Swedish, and the content is real 3FS075 material.

Screens, each mapped to a plan feature:
1. **Bibliotek:** lecture decks (Effektmått, Bias & confounding, DDD, Hälsoekonomi…) as colored cards with % behärskat, "Lärt denna vecka", and a streak.
2. **Kursöversikt:** overall coverage %, tiles for Övningspass / Tentasimulering / Felbank / Täckningskarta, "14 kort att repetera idag", and a "Starta plugget" CTA.
3. **Flerval:** an MCQ with the confidence toggle "Säker / Gissade".
4. **Beräkning:** a DDD/1000 inv/dag question with a number field, then the worked solution.
5. **Fritext, facit revealed:** the official answer card ("Officiellt facit"), then student examples ranked by score ("Studentsvar · 5/5 p ✓" and "Studentsvar · 3/5 p", with a grader comment). A key-point checklist and the Igen/Svår/Bra/Lätt self-grade buttons.
6. **Osäkert facit:** a question with only partial student answers, showing the warning badge.
7. **Täckningskarta:** per-lecture bars (ej påbörjad / sedd / behärskad) and exam frequency markers.
8. **Tentasimulering, result:** a big "38/50 p" and a per-topic breakdown.

It is one self-contained HTML page with a responsive grid of phones, published privately as an Artifact for you to react to. Any design feedback goes back into this plan before Phase 1.

## Phases, in priority order for the deadline

**Phase 0: Content extraction (Claude, about day 1)**
- Install read tooling in a scratch venv (`pypdf`), or `brew install poppler`, so the PDFs can be read. Scanned exams need the Read tool for page images.
- Extract questions from the exams that have grading guides first: 2024-08-16, 2025-10-01, 2026-02-20. Official answers and key points come from the `Bedömningsvägledning` files.
- Then go through the student copies. The same question from different years is merged into one entry (matched by wording), and each student answer is attached with its awarded points where the file shows them. When a file has no scores, the answer is stored as `awarded` unknown and counts as untrusted.
- Build the objective list from the lecture PDFs and tag each question.
- You export the `.pages` files (instuderingsfrågor, workshop, quiz hälsoekonomi, gamla tentor) to PDF so they can be included.
- Output: `content/3fs075.json`, which you spot-check in the review UI.

**Phase 1: MVP (usable within a few days)**
- Screens: Kursval → Översikt (topics with counts) → Övningspass.
- Players: MCQ (instant feedback plus confidence: "säker / gissade"), Fritext (write, then reveal the model answer and a key-point checklist, then self-grade Igen/Svår/Bra/Lätt), Beräkning (enter a number and get it checked against the tolerance, then the worked solution).
- JSON import/export of course and progress. Dexie storage.
- Deploy to GitHub Pages via Actions right away so she can start using it.

**Phase 2: Study techniques**
- `ts-fsrs` scheduling with an "Att repetera idag" queue. Interleaved mixed sessions. Felbank (mistake log / leeches).
- Tentasimulering: a timed exam built from the real exam mix, with points and a score at the end.
- Artikelgranskning view: article on the left, her notes on the right, then the model answer.

**Phase 2b: Coverage**
- Objective/lecture tree marked ej påbörjad / sedd / behärskad (all of its questions have FSRS stability ≥ 21 days). Shows % per lecture and in total.
- A "Luckor" session that pulls from objectives not yet mastered, weighted by how often they appear on exams.

**Phase 3: AI (optional, if time allows)**
- API key entered in Inställningar and stored locally. The browser calls the Anthropic API directly (model `claude-sonnet-5`).
- "Få feedback" on free-text and audit answers, graded against modelAnswer, keyPoints and gradingNotes.
- PDF upload → questions/objectives → review screen. Gap filling produces questions labelled "AI-genererad", which she has to approve.

**Phase 4: Polish**
- PWA install and offline support, stats page (retention, accuracy per topic), streak and daily goal.

## Verification
- Vitest for the pure logic: FSRS wrapper, calculation tolerance check, exam-sim scoring, coverage computation, `hasTrustedAnswer` (official / full-mark student / partial / unknown score).
- After each phase: `npm run dev`, then play through one full real exam (2025-10-01) using the run skill or a browser.
- Before handing it over: deploy to Pages, import the content JSON, install as a PWA, go offline and confirm it works. Export progress, clear site data, re-import, and confirm the progress is restored.

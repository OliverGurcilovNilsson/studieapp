---
name: extract-course
description: Extract questions, answers, objectives and article-review material from a folder of course PDFs (exams, grading guides, student copies, lectures, own notes) into the Studieapp content-bundle format. Use when turning course material into importable study content, or when processing one source file of a course.
---

# Extract course material into a Studieapp bundle

The format is defined in `src/content/schema.ts`. Read it before writing anything, because it is the contract. Everything you produce goes in the course's **content folder, outside this repo** (for example `~/Downloads/<Course>/content/`). Never write course material, extracted text or images into the repo.

## Layout of the content folder
```
content/
  sources.json          # classification of every file (Source[]), confirmed by the user
  parts/<sourceId>.json # one partial bundle per processed source (only the arrays it fills)
  assets/<id>.png|pdf   # cropped figures, article PDFs
  <course>.json         # merged, validated bundle (built by the merge script)
```
One worker processes one source and writes one `parts/<sourceId>.json`. Workers never edit each other's files. The merge step builds the final bundle.

## Reading PDFs
- Text layer: `pypdf` (a venv outside the repo). Check the characters per page: under ~400 means an image-heavy page, so **read the page visually** with the Read tool (render the pages to PNG first).
- Broken ligatures: some exports turn `ti`→`@`/`,`, `tt`→`=`, `fl`/`ft`→`O`. When the text shows these, read the page visually rather than guessing.
- **Remove personal data** from third-party files: Studocu watermarks ("Downloaded by <name> (<email>)", `lOMoAR…` codes, "Scan to open on Studocu"), candidate ids, phone numbers and e-mail addresses. Keep teachers' names only where the course material itself names them.

## Provenance rules (decisive, never guess)
| Source kind | Answer provenance | Notes |
|---|---|---|
| grading_guide | `official` | The authoritative key; include the point rules as keyPoints / commonMistakes |
| course_quiz | `official` | Course-provided answers |
| student_copy | `student` | Set `awarded`/`max` **only if the file shows the score** for that question; otherwise leave both out (the score is unknown) |
| own_notes | `own_notes` | Her own notes (seminars, workshops, "gamla tentor"). Some were AI-assisted: check facts against official sources where they overlap, and put contradictions in a `notes` field of the part file |

- **An answer's `text` contains only what its source says**: verbatim, or a faithful condensation. Never add your own reasoning, numbers or clarifications to an `official` (or any) answer. Put anything you add in the question's `explanation` field instead; it is shown labelled "Förklaring – ej facit". Recalculated values that fix an obvious typo in the source also go in `explanation`, with a reviewer note.
- Exception: `numeric.solution` (worked steps) may be written by you. It is shown as "Lösningsgång", never as the answer key. Every step's arithmetic must reproduce the official value exactly.
- A student answer is correct only when `awarded === max`. Never copy a partial student answer into `keyPoints`.
- Grader comments ("Rättarens kommentar") go in `graderComment`.
- A condensed answer ("Kort svar till workshopen") goes in `short`, and the long text in `text`.

## Questions
- **ids**: `<examId>-q<number>` for exam questions (e.g. `2025-10-01-q3b`), `<sourceId>-<n>` otherwise. They must be stable, because progress is linked to them.
- The same exam appearing in several sources is **one exam**: match on date and question wording. Add answers to the existing question; don't create duplicates.
- **Types**:
  - `mcq`: exactly one correct option.
  - `mcq_multi`: "Välj ett eller flera"; set `negativeMarking: true` when the question says wrong choices cost points.
  - `calculation`: set `numeric.value`, `unit` and `decimals` (the required rounding; the grading guides deduct points for wrong rounding) and `solution` steps.
  - `flashcard`: definitions only.
  - `free_text`: everything else.
- Multi-part questions share a `context` (the case text), with one question per sub-part, each with its own `points`.
- Figures the question needs: crop the page to `assets/`, add an `Asset` and reference it in `assetIds`.
- `keyPoints`: what earns points (from the official answer). `commonMistakes`: what the grading guide says costs points.
- `part: 'article'` for the article-review section of an exam.
- `topic` / `objectiveIds`: use the course's objective list once it exists. Before that, set `topic` to one of the lecture topics and leave `objectiveIds` empty.
- Extracted questions get `status: 'approved'` (they are real course material). Only AI-generated cards (`origin: 'generated'`) start as `unverified`.

## Article review
- The seminar question sheet (a `seminar_questions` source) becomes a `ReviewTemplate`, with one item per checklist question and its section (Bakgrund / Metod / Resultat / Diskussion).
- Each article becomes a `PracticeArticle` with its PDF as an asset.
- Her seminar answers become `article_review` questions (`articleId` + `templateItemId`) with `own_notes` answers.
- General lessons inside those answers (e.g. the clues that reveal a study design) also become normal `free_text` / `flashcard` questions with `origin: 'seminar'`.

## Generated cards (lectures)
Only generate from a lecture when asked. Every card must cite `evidence` (source, pages, a quote that appears on those pages), `origin: 'generated'`, `status: 'unverified'`. Use facts from the slides only. Match the style of past exam questions on the same topic.

## Output checklist for each part file
- [ ] Valid JSON, and the arrays match `schema.ts`
- [ ] No personal data, no absolute paths
- [ ] Every question has at least one answer, or is deliberately answerless (study_questions)
- [ ] Every `student` score was read from the file, not inferred
- [ ] Report back: counts per type, questions you were unsure about, and any facts in `own_notes` that contradict official sources

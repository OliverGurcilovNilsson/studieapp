// Merges extracted part files into one importable course bundle.
// Usage: node --experimental-strip-types scripts/build-content.ts <content-dir> <course-id>
// Reads <content-dir>/sources.json, parts/*.json, assets/*; writes <content-dir>/<course-id>.json.
// Course material never enters the repo: this script only reads and writes the content dir.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  hasTrustedAnswer,
  type Asset,
  type ContentBundle,
  type Exam,
  type Question,
  type Source,
} from '../src/content/schema.ts'

type Part = Partial<Omit<ContentBundle, 'course' | 'format' | 'version'>> & {
  examInfo?: ContentBundle['course']['examInfo']
  sourceIds?: string[]
  notes?: string[]
}

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' }
const PERSONAL_DATA = [/[\w.+-]+@[\w-]+\.[\w.]+/, /Downloaded by/i, /lOMoAR/, /Studocu/i]

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** Same exam from several sources: keep one exam, union its sources. */
function mergeExams(into: Map<string, Exam>, exam: Exam) {
  const prev = into.get(exam.id)
  if (!prev) return void into.set(exam.id, { ...exam, sourceIds: [...exam.sourceIds] })
  prev.sourceIds = [...new Set([...prev.sourceIds, ...exam.sourceIds])]
  if (prev.kind === 'unknown') prev.kind = exam.kind
}

/** Lower is more authoritative: the question wording is taken from the best source that has it. */
const SOURCE_PRIORITY: Partial<Record<Source['kind'], number>> = {
  official_exam: 0,
  grading_guide: 0,
  course_quiz: 0,
  student_copy: 1,
}

/** Same question from several sources: keep the most authoritative body, collect every answer. */
function mergeQuestions(into: Map<string, Question & { _priority: number }>, q: Question, priority: number) {
  const prev = into.get(q.id)
  if (!prev) return void into.set(q.id, { ...q, answers: [...q.answers], _priority: priority })
  const seen = new Set(prev.answers.map((a) => `${a.sourceId}|${a.text}`))
  const answers = [...prev.answers, ...q.answers.filter((a) => !seen.has(`${a.sourceId}|${a.text}`))]
  if (priority < prev._priority) {
    // A more authoritative source: take its wording, but keep a key (correct/numeric) the old body had.
    Object.assign(prev, { ...q, correct: q.correct ?? prev.correct, numeric: q.numeric ?? prev.numeric, _priority: priority })
  } else {
    prev.correct ??= q.correct
    prev.numeric ??= q.numeric
    prev.options ??= q.options
  }
  prev.answers = answers
  // Official answers first, then student answers by score, then own notes.
  const rank = (a: Question['answers'][number]) =>
    a.provenance === 'official' ? 0 : a.provenance === 'student' ? 1 - (a.awarded ?? 0) / (a.max || 1) : 2
  prev.answers.sort((a, b) => rank(a) - rank(b))
}

function validate(bundle: ContentBundle): string[] {
  const problems: string[] = []
  const assetIds = new Set(bundle.assets.map((a) => a.id))
  const sourceIds = new Set(bundle.sources.map((s) => s.id))
  for (const q of bundle.questions) {
    const where = `question ${q.id}`
    if (!q.prompt?.trim()) problems.push(`${where}: empty prompt`)
    if ((q.type === 'mcq' || q.type === 'mcq_multi') && !(q.options?.length && q.correct?.length))
      problems.push(`${where}: MCQ without options/correct`)
    if (q.type === 'mcq' && (q.correct?.length ?? 0) > 1) problems.push(`${where}: mcq with several correct → use mcq_multi`)
    if (q.correct?.some((c) => !q.options?.some((o) => o.id === c))) problems.push(`${where}: correct id not among options`)
    if (q.type === 'calculation' && typeof q.numeric?.value !== 'number') problems.push(`${where}: calculation without numeric.value`)
    for (const id of q.assetIds ?? []) if (!assetIds.has(id)) problems.push(`${where}: missing asset ${id}`)
    for (const a of q.answers) {
      if (!sourceIds.has(a.sourceId)) problems.push(`${where}: answer from unknown source ${a.sourceId}`)
      if (a.provenance !== 'student' && (a.awarded !== undefined || a.max !== undefined))
        problems.push(`${where}: score on a non-student answer`)
    }
    if (q.origin === 'generated' && !q.evidence?.length) problems.push(`${where}: generated card without evidence`)
    const text = JSON.stringify(q)
    for (const re of PERSONAL_DATA) if (re.test(text)) problems.push(`${where}: possible personal data (${re})`)
  }
  return problems
}

function main() {
  const [dir, courseId] = process.argv.slice(2)
  if (!dir || !courseId) throw new Error('usage: build-content.ts <content-dir> <course-id>')

  const sources = readJson<Source[]>(join(dir, 'sources.json'))
  const exams = new Map<string, Exam>()
  const questions = new Map<string, Question & { _priority: number }>()
  const kindOf = new Map(sources.map((s) => [s.id, s.kind]))
  const assets = new Map<string, Asset>()
  const bundle: ContentBundle = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    course: { id: courseId, code: '3FS075', name: 'Farmakoepidemiologi och farmakoekonomi', lang: 'sv' },
    sources,
    lectures: [],
    objectives: [],
    exams: [],
    questions: [],
    reviewTemplates: [],
    articles: [],
    assets: [],
  }
  const notes: string[] = []

  const partsDir = join(dir, 'parts')
  for (const file of readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort()) {
    const part = readJson<Part>(join(partsDir, file))
    part.exams?.forEach((e) => mergeExams(exams, e))
    const priority = Math.min(3, ...(part.sourceIds ?? []).map((id) => SOURCE_PRIORITY[kindOf.get(id)!] ?? 2))
    part.questions?.forEach((q) => mergeQuestions(questions, q, priority))
    part.assets?.forEach((a) => assets.set(a.id, a))
    bundle.lectures.push(...(part.lectures ?? []))
    bundle.objectives.push(...(part.objectives ?? []))
    bundle.reviewTemplates.push(...(part.reviewTemplates ?? []))
    bundle.articles.push(...(part.articles ?? []))
    if (part.examInfo && !bundle.course.examInfo) bundle.course.examInfo = part.examInfo
    for (const n of part.notes ?? []) notes.push(`${file}: ${n}`)
  }

  // Inline asset files as base64 so the bundle is one self-contained file.
  for (const a of assets.values()) {
    if (a.path && !a.data) {
      const p = join(dir, a.path)
      if (!existsSync(p)) throw new Error(`asset ${a.id}: file not found ${a.path}`)
      a.data = readFileSync(p).toString('base64')
      a.mime ||= MIME[extname(p).toLowerCase()] ?? 'application/octet-stream'
      delete a.path
    }
  }

  bundle.exams = [...exams.values()].sort((a, b) => a.date.localeCompare(b.date))
  bundle.questions = [...questions.values()].map(({ _priority, ...q }) => q)
  bundle.assets = [...assets.values()]

  const problems = validate(bundle)
  const out = join(dir, `${courseId}.json`)
  writeFileSync(out, JSON.stringify(bundle))

  const byType = Object.groupBy(bundle.questions, (q) => q.type)
  const untrusted = bundle.questions.filter((q) => !hasTrustedAnswer(q)).length
  console.log(`wrote ${out}`)
  console.log(`exams ${bundle.exams.length}, questions ${bundle.questions.length}, assets ${bundle.assets.length}`)
  console.log('by type:', Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v?.length])))
  console.log(`without trusted answer: ${untrusted}`)
  if (notes.length) console.log(`\nreviewer notes (${notes.length}):\n- ${notes.join('\n- ')}`)
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`)
    process.exitCode = 1
  }
}

main()

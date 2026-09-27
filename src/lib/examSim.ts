// Tentasimulering: a timed run through one past exam, scored like the real thing. Pure functions.
import type { Course, Question } from '../content/schema'
import type { Grade } from './examMode'
import { isSelfGraded } from './practice'
import { checkNumeric, scoreMulti } from './scoring'
import { isPractisable } from './session'
import { topicName } from './topics'

export const EXAM_DURATION_MS = 4 * 3_600_000

/** What she wrote or picked for one question. */
export interface SimAnswer {
  choice?: string // mcq
  selected?: string[] // mcq_multi
  input?: string // calculation
  text?: string // free text types
}

/** Timer that can be paused: time used so far plus the running stretch, if any. */
export interface SimClock {
  elapsedMs: number
  runningSince?: number
}

export function elapsed(clock: SimClock, now: number): number {
  return clock.elapsedMs + (clock.runningSince !== undefined ? now - clock.runningSince : 0)
}

export function remaining(clock: SimClock, now: number, duration = EXAM_DURATION_MS): number {
  return Math.max(0, duration - elapsed(clock, now))
}

export function pause(clock: SimClock, now: number): SimClock {
  return { elapsedMs: elapsed(clock, now) }
}

export function resume(clock: SimClock, now: number): SimClock {
  return clock.runningSince !== undefined ? clock : { ...clock, runningSince: now }
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${h}:${pad(m)}:${pad(s % 60)}`
}

/** The exam's questions as on the paper: by number ("2", "3a", "3b", "10"), concepts before the article. */
export function paperOrder(questions: Question[], examId: string): Question[] {
  const partRank = (q: Question) => (q.part === 'article' ? 1 : 0)
  return questions
    .filter((q) => q.examId === examId && isPractisable(q))
    .sort(
      (a, b) =>
        partRank(a) - partRank(b) || (a.number ?? a.id).localeCompare(b.number ?? b.id, 'sv', { numeric: true }),
    )
}

export const maxPoints = (q: Question) => q.points ?? 1

/**
 * Points for an auto-scored type, or undefined when she scores it herself. Wrong rounding
 * scores 0, the same strict rule as in practice.
 */
export function autoScore(q: Question, a: SimAnswer | undefined): number | undefined {
  if (isSelfGraded(q)) return undefined
  const max = maxPoints(q)
  if (q.type === 'mcq') return a?.choice !== undefined && q.correct?.includes(a.choice) ? max : 0
  if (q.type === 'mcq_multi') return a?.selected?.length ? scoreMulti(a.selected, q.correct ?? [], max, q.negativeMarking) : 0
  if (q.type === 'calculation' && q.numeric) return a?.input && checkNumeric(a.input, q.numeric).kind === 'correct' ? max : 0
  return undefined
}

export interface ScoreLine {
  label: string
  points: number
  max: number
}

export interface SimResult {
  total: number
  max: number
  parts: ScoreLine[]
  types: ScoreLine[]
  topics: ScoreLine[]
  /** Questions that did not get full points. */
  missed: string[]
  grade: Grade
  passAt: number
  distinctionAt?: number
}

const TYPE_GROUP: Record<Question['type'], string> = {
  mcq: 'Flerval',
  mcq_multi: 'Flerval',
  calculation: 'Beräkning',
  free_text: 'Fritext & artikelgranskning',
  article_review: 'Fritext & artikelgranskning',
  flashcard: 'Fritext & artikelgranskning',
}

function group(lines: Map<string, ScoreLine>, label: string, points: number, max: number) {
  const l = lines.get(label) ?? { label, points: 0, max: 0 }
  l.points += points
  l.max += max
  lines.set(label, l)
}

/**
 * The G/VG limits for this paper. A past exam in the bundle may not total the course's
 * maxPoints (a missing question, a different year), so the limits scale to its total.
 */
export function thresholds(examInfo: Course['examInfo'], max: number): { passAt: number; distinctionAt?: number } {
  if (!examInfo) return { passAt: Math.ceil(max * 0.6) }
  const scale = max / examInfo.maxPoints
  return {
    passAt: Math.round(examInfo.passPoints * scale * 2) / 2,
    distinctionAt:
      examInfo.distinctionPoints !== undefined ? Math.round(examInfo.distinctionPoints * scale * 2) / 2 : undefined,
  }
}

export function scoreExam(
  questions: Question[],
  answers: Record<string, SimAnswer>,
  selfScores: Record<string, number>,
  examInfo?: Course['examInfo'],
): SimResult {
  const parts = new Map<string, ScoreLine>()
  const types = new Map<string, ScoreLine>()
  const topics = new Map<string, ScoreLine>()
  const missed: string[] = []
  let total = 0
  let max = 0
  for (const q of questions) {
    const m = maxPoints(q)
    const p = Math.min(m, Math.max(0, autoScore(q, answers[q.id]) ?? selfScores[q.id] ?? 0))
    total += p
    max += m
    if (p < m) missed.push(q.id)
    group(parts, q.part === 'article' ? 'Artikelgranskning' : 'Begrepp och beräkningar', p, m)
    group(types, TYPE_GROUP[q.type], p, m)
    group(topics, topicName(q.topic), p, m)
  }
  const { passAt, distinctionAt } = thresholds(examInfo, max)
  const grade: Grade = distinctionAt !== undefined && total >= distinctionAt ? 'VG' : total >= passAt ? 'G' : 'U'
  return {
    total,
    max,
    parts: [...parts.values()],
    types: [...types.values()],
    topics: [...topics.values()].sort((a, b) => a.points / a.max - b.points / b.max),
    missed,
    grade,
    passAt,
    distinctionAt,
  }
}

/** "Svagast just nu": topics under 60 % on this paper, weakest first, at most three. */
export function weakest(result: SimResult): string[] {
  return result.topics
    .filter((t) => t.max > 0 && t.points / t.max < 0.6)
    .slice(0, 3)
    .map((t) => t.label)
}


export function isAnswered(a?: SimAnswer): boolean {
  return !!(a?.choice || a?.selected?.length || a?.input?.trim() || a?.text?.trim())
}

/** "Fråga 3b · Effektmått · 2 p" */
export function questionHeading(q: Question): string {
  return [q.number ? `Fråga ${q.number}` : undefined, topicName(q.topic), `${maxPoints(q).toLocaleString('sv-SE')} p`]
    .filter(Boolean)
    .join(' · ')
}

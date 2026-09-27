import { Rating, type Grade } from 'ts-fsrs'
import type { Question, QuestionType } from '../content/schema'
import type { ReviewState } from '../db/db'
import { isPractisable, type QueueItem } from './session'
import type { NumericVerdict } from './scoring'

/** How an auto-scored answer went. Self-graded types have no outcome until she rates. */
export type Outcome = 'correct' | 'partial' | 'wrong'

export const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Flerval',
  mcq_multi: 'Flerval, flera rätt',
  calculation: 'Beräkning',
  free_text: 'Fritext',
  flashcard: 'Begrepp',
  article_review: 'Artikelgranskning',
}

/** Types she scores herself: write, reveal the key, then rate Igen/Svår/Bra/Lätt. */
export function isSelfGraded(q: Question): boolean {
  if (q.type === 'mcq' || q.type === 'mcq_multi') return false
  if (q.type === 'calculation') return q.numeric === undefined
  return true
}

/** The rating an auto-scored answer gets when she just presses "Nästa". Wrong rounding counts as wrong. */
export function gradeFor(outcome: Outcome): Grade {
  return outcome === 'correct' ? Rating.Good : outcome === 'partial' ? Rating.Hard : Rating.Again
}

export function numericOutcome(v: NumericVerdict): Outcome | undefined {
  if (v.kind === 'unparseable') return undefined
  return v.kind === 'correct' ? 'correct' : 'wrong'
}

export function multiOutcome(score: number, points: number): Outcome {
  if (score >= points - 1e-9) return 'correct'
  return score > 0 ? 'partial' : 'wrong'
}

export interface SessionResult {
  questionId: string
  grade: Grade
  /** An auto-scored outcome, when there was one. */
  outcome?: Outcome
}

/** Right = auto-scored correct, or self-rated Bra/Lätt. Everything else is a miss to repeat. */
export function isRight(r: SessionResult): boolean {
  return r.outcome ? r.outcome === 'correct' && r.grade >= Rating.Good : r.grade >= Rating.Good
}

export function summarize(results: SessionResult[]) {
  const last = new Map(results.map((r) => [r.questionId, r])) // a repeated question counts once, by its latest try
  const all = [...last.values()]
  const missed = all.filter((r) => !isRight(r)).map((r) => r.questionId)
  return { total: all.length, right: all.length - missed.length, missed }
}

/**
 * "Öva ändå": when nothing is due, practise the reviewed questions that come due soonest.
 * Never includes new questions (buildQueue paces those).
 */
export function buildAheadQueue(
  questions: Question[],
  states: Map<string, ReviewState>,
  { topic, examId, limit = 20 }: { topic?: string; examId?: string; limit?: number } = {},
): QueueItem[] {
  return questions
    .filter((q) => isPractisable(q) && states.has(q.id) && (!topic || q.topic === topic) && (!examId || q.examId === examId))
    .sort((a, b) => states.get(a.id)!.due - states.get(b.id)!.due)
    .slice(0, limit)
    .map((q) => ({ question: q, state: states.get(q.id) }))
}

/** "Bias & confounding · Fritext · 4 p" */
export function questionLabel(q: Question, topicName: (t: string) => string): string {
  const topic = topicName(q.topic)
  const type = TYPE_LABELS[q.type]
  return [topic, type === topic ? '' : type, q.points !== undefined ? `${q.points.toLocaleString('sv-SE')} p` : '']
    .filter(Boolean)
    .join(' · ')
}

/** A session over exactly these questions, in this order (e.g. "Repetera missarna" after a simulation). */
export function pickQuestions(questions: Question[], states: Map<string, ReviewState>, ids: string[]): QueueItem[] {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return ids.filter((id) => byId.has(id) && isPractisable(byId.get(id)!)).map((id) => ({ question: byId.get(id)!, state: states.get(id) }))
}

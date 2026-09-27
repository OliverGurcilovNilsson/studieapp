// Täckningskarta: how much of each topic she has mastered, seen or not started. Pure functions.
import { hasTrustedAnswer, type Objective, type Question } from '../content/schema'
import { isKeyTrusted } from './trust'
import type { ReviewState } from '../db/db'
import { isSelfGraded } from './practice'
import { interleave, isPractisable, type QueueItem } from './session'

/** Stability of at least three weeks: answered correctly across several separate days (the plan's definition). */
export const MASTERED_STABILITY_DAYS = 21

/**
 * Mastered = stable in memory AND checked against a key she can trust. Questions with only
 * own notes or partial student answers can be "seen" but never "mastered".
 */
export function isMastered(q: Question, state: ReviewState | undefined): boolean {
  if (!state || state.card.stability < MASTERED_STABILITY_DAYS) return false
  return isKeyTrusted(q, state)
}

export interface TopicCoverage {
  topic: string
  total: number
  mastered: number
  /** Seen but not mastered. */
  seen: number
  notStarted: number
  /** Past exams with at least one question on the topic. */
  exams: number
  /** Questions without a trusted answer or own notes ("Osäkert facit"). */
  uncertain: number
}

export function coverage(
  questions: Question[],
  states: Map<string, ReviewState>,
  objectives: Pick<Objective, 'topic'>[] = [],
): { topics: TopicCoverage[]; examCount: number; mastered: number; total: number } {
  const rows = new Map<string, TopicCoverage & { examIds: Set<string> }>()
  const row = (topic: string) => {
    if (!rows.has(topic))
      rows.set(topic, { topic, total: 0, mastered: 0, seen: 0, notStarted: 0, exams: 0, uncertain: 0, examIds: new Set() })
    return rows.get(topic)!
  }
  for (const o of objectives) row(o.topic)
  const allExams = new Set<string>()
  for (const q of questions) {
    if (q.examId) {
      allExams.add(q.examId)
      row(q.topic).examIds.add(q.examId)
    }
    if (!isPractisable(q)) continue
    const r = row(q.topic)
    const s = states.get(q.id)
    r.total++
    if (isMastered(q, s)) r.mastered++
    else if (s) r.seen++
    else r.notStarted++
    // Own notes are a reference with their own mild label, not "Osäkert facit" (docs/PLAN.md).
    if (isSelfGraded(q) && !hasTrustedAnswer(q) && !q.answers.some((a) => a.provenance === 'own_notes' || a.provenance === 'generated')) r.uncertain++
  }
  const topics = [...rows.values()]
    .map(({ examIds, ...r }) => ({ ...r, exams: examIds.size }))
    .sort((a, b) => b.exams - a.exams || b.total - a.total || a.topic.localeCompare(b.topic, 'sv'))
  const total = topics.reduce((a, t) => a + t.total, 0)
  const mastered = topics.reduce((a, t) => a + t.mastered, 0)
  return { topics, examCount: allExams.size, mastered, total }
}

/**
 * "Plugga luckorna": questions not yet mastered, from the topics with the biggest gap weighted
 * by how often the topic is on exams. Within a topic: unseen first, then the least stable.
 */
export function gapQueue(questions: Question[], states: Map<string, ReviewState>, limit = 20): QueueItem[] {
  const { topics } = coverage(questions, states)
  const priority = new Map(topics.map((t) => [t.topic, (t.exams + 1) * (t.total ? 1 - t.mastered / t.total : 0)]))
  const stability = (q: Question) => states.get(q.id)?.card.stability ?? -1
  const open = questions
    .filter((q) => isPractisable(q) && !isMastered(q, states.get(q.id)) && priority.get(q.topic)! > 0)
    .sort((a, b) => priority.get(b.topic)! - priority.get(a.topic)! || stability(a) - stability(b))
  return interleave(open, (q) => q.topic)
    .slice(0, limit)
    .map((q) => ({ question: q, state: states.get(q.id) }))
}

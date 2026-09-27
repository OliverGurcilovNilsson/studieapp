// Felbank: the questions she keeps missing. Pure functions.
import type { Question } from '../content/schema'
import type { ReviewLogEntry, ReviewState } from '../db/db'
import { isPractisable } from './session'

export const LAPSE_THRESHOLD = 2

export interface Mistake {
  question: Question
  state?: ReviewState
  /** Times she forgot it after having learned it (FSRS lapses). */
  lapses: number
  /** Times rated "Igen" in total. */
  misses: number
  lastRatedAgain: boolean
  lastMissAt?: number
}

/** Questions with at least two lapses, or whose most recent rating was "Igen". Latest miss first. */
export function mistakeBank(
  questions: Question[],
  states: Map<string, ReviewState>,
  log: Pick<ReviewLogEntry, 'questionId' | 'ts' | 'rating'>[],
): Mistake[] {
  const last = new Map<string, { ts: number; rating: number }>()
  const misses = new Map<string, number>()
  const lastMiss = new Map<string, number>()
  for (const e of log) {
    if (!last.has(e.questionId) || e.ts >= last.get(e.questionId)!.ts) last.set(e.questionId, e)
    if (e.rating === 1) {
      misses.set(e.questionId, (misses.get(e.questionId) ?? 0) + 1)
      lastMiss.set(e.questionId, Math.max(lastMiss.get(e.questionId) ?? 0, e.ts))
    }
  }
  return questions
    .filter(isPractisable)
    .map((q) => {
      const state = states.get(q.id)
      return {
        question: q,
        state,
        lapses: state?.card.lapses ?? 0,
        misses: misses.get(q.id) ?? 0,
        lastRatedAgain: last.get(q.id)?.rating === 1,
        lastMissAt: lastMiss.get(q.id),
      }
    })
    .filter((m) => m.lapses >= LAPSE_THRESHOLD || m.lastRatedAgain)
    .sort((a, b) => (b.lastMissAt ?? 0) - (a.lastMissAt ?? 0))
}

import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'

export interface QueueItem {
  question: Question
  state?: ReviewState
}

export interface QueueOptions {
  topic?: string
  examId?: string
  limit?: number
  newLimit?: number
}

/** A question can be practised when there is something to compare her answer with. */
export function isPractisable(q: Question): boolean {
  if (!q.prompt?.trim()) return false
  if (q.type === 'mcq' || q.type === 'mcq_multi') return !!q.correct?.length
  if (q.type === 'calculation') return q.numeric !== undefined || q.answers.length > 0
  return q.answers.length > 0
}

/** Round-robin across topics, so a session interleaves subjects instead of blocking them. */
export function interleave<T>(items: T[], key: (t: T) => string): T[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(item)
  }
  const out: T[] = []
  const queues = [...groups.values()]
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!)
  return out
}

/**
 * Due reviews first (most overdue first), then new questions. New questions come from
 * the most recent exams first and are interleaved by topic.
 */
export function buildQueue(
  questions: Question[],
  states: Map<string, ReviewState>,
  now: number,
  { topic, examId, limit = 20, newLimit = 10 }: QueueOptions = {},
): QueueItem[] {
  const pool = questions.filter(
    (q) => isPractisable(q) && (!topic || q.topic === topic) && (!examId || q.examId === examId),
  )

  const due = pool
    .filter((q) => states.get(q.id) && states.get(q.id)!.due <= now)
    .sort((a, b) => states.get(a.id)!.due - states.get(b.id)!.due)
    .slice(0, limit)
    .map((q) => ({ question: q, state: states.get(q.id) }))

  const room = Math.min(newLimit, limit - due.length)
  const fresh = interleave(
    pool.filter((q) => !states.has(q.id)).sort((a, b) => (b.examId ?? '').localeCompare(a.examId ?? '')),
    (q) => q.topic,
  )
    .slice(0, Math.max(0, room))
    .map((q) => ({ question: q }))

  // In an exam-specific session keep the paper's order.
  if (examId) return [...due, ...fresh].sort((a, b) => a.question.id.localeCompare(b.question.id, 'sv', { numeric: true }))
  return [...due, ...fresh]
}

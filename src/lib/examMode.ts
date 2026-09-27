// Tentaläge: the exam-aware daily plan and forecast (docs/PLAN.md, "Tentaläge").
// Pure functions only; the pages load the data and pass it in.
import { Rating } from 'ts-fsrs'
import { type Course, type Question, type QuestionType } from '../content/schema'
import { isKeyTrusted } from './trust'
import type { ReviewState } from '../db/db'
import { buildQueue, interleave, isPractisable, type QueueItem } from './session'
import { newCard, retrievability, review } from './scheduler'

const DAY = 86_400_000
/** No new questions in the last days before the exam: only consolidation. */
export const NO_NEW_DAYS = 3

/** Rough time per question, used until there is enough of her own timing data. */
export const DEFAULT_SECONDS: Record<QuestionType, number> = {
  flashcard: 20,
  mcq: 30,
  mcq_multi: 45,
  calculation: 120,
  free_text: 150,
  article_review: 150,
}

export function isExamModeActive(examDate: number | undefined, now: number): examDate is number {
  return examDate !== undefined && examDate > now
}

export function daysUntil(examDate: number, now: number): number {
  return Math.max(0, Math.ceil((examDate - now) / DAY))
}

/**
 * Each topic's share of the points on past exams (sums to 1). Topics that never appear on an
 * exam still get a small floor (half the smallest real share), so they are not ignored entirely.
 */
export function topicWeights(questions: Question[]): Map<string, number> {
  const points = new Map<string, number>()
  for (const q of questions) {
    if (!points.has(q.topic)) points.set(q.topic, 0)
    if (q.examId) points.set(q.topic, points.get(q.topic)! + (q.points ?? 1))
  }
  const positive = [...points.values()].filter((p) => p > 0)
  const floor = positive.length ? Math.min(...positive) / 2 : 1
  const raw = new Map([...points].map(([t, p]) => [t, p > 0 ? p : floor]))
  const total = [...raw.values()].reduce((a, b) => a + b, 0)
  return new Map([...raw].map(([t, p]) => [t, total ? p / total : 0]))
}

/** Probability of recalling the question on exam day; unseen questions count as 0. */
export function rExam(state: ReviewState | undefined, examDate: number): number {
  return state ? retrievability(state.card, examDate) : 0
}

/** How much one successful review now raises recall on exam day. */
export function examGain(state: ReviewState | undefined, now: number, examDate: number): number {
  const after = review(state?.card ?? newCard(now), Rating.Good, now, { examDate })
  return Math.max(0, retrievability(after, examDate) - rExam(state, examDate))
}

/** New questions to start today: spread what is left over the days before the no-new window. */
export function newPerDay(notStarted: number, examDate: number, now: number): number {
  const days = daysUntil(examDate, now) - NO_NEW_DAYS
  if (days <= 0 || notStarted <= 0) return 0
  return Math.ceil(notStarted / days)
}

export interface DayPlanInput {
  questions: Question[]
  states: Map<string, ReviewState>
  now: number
  examDate: number
  minutesPerDay: number
  /** New questions already started today (from the review log). */
  startedToday?: number
  topic?: string
  seconds?: Partial<Record<QuestionType, number>>
}

export interface PlannedItem extends QueueItem {
  /** Expected share of the exam's points this review adds, per second spent. */
  value: number
  seconds: number
}

/**
 * Today's queue in exam mode. Candidates are the due questions plus today's quota of new ones.
 * Each is valued as topicShare / questionsInTopic × ΔR_exam / seconds, and the best are taken
 * until the time budget is full, then interleaved by topic.
 */
export function planDay({
  questions,
  states,
  now,
  examDate,
  minutesPerDay,
  startedToday = 0,
  topic,
  seconds = {},
}: DayPlanInput): PlannedItem[] {
  const pool = questions.filter(isPractisable)
  const weights = topicWeights(pool)
  const perTopic = new Map<string, number>()
  for (const q of pool) perTopic.set(q.topic, (perTopic.get(q.topic) ?? 0) + 1)

  const secs = (q: Question) => seconds[q.type] ?? DEFAULT_SECONDS[q.type]
  const valued = (q: Question): PlannedItem => {
    const state = states.get(q.id)
    const share = (weights.get(q.topic) ?? 0) / perTopic.get(q.topic)!
    return { question: q, state, seconds: secs(q), value: (share * examGain(state, now, examDate)) / secs(q) }
  }
  const scoped = pool.filter((q) => !topic || q.topic === topic)
  const due = scoped.filter((q) => states.has(q.id) && states.get(q.id)!.due <= now).map(valued)

  const notStarted = pool.filter((q) => !states.has(q.id)).length
  const quota = Math.max(0, newPerDay(notStarted + startedToday, examDate, now) - startedToday)
  const fresh = scoped
    .filter((q) => !states.has(q.id))
    .map(valued)
    .sort((a, b) => b.value - a.value)
    .slice(0, quota)

  const ranked = [...due, ...fresh].sort((a, b) => b.value - a.value)
  const budget = minutesPerDay * 60
  const picked: PlannedItem[] = []
  let used = 0
  for (const item of ranked) {
    if (picked.length && used + item.seconds > budget) continue
    picked.push(item)
    used += item.seconds
  }
  return interleave(picked, (i) => i.question.topic)
}

/** Only questions with a trustworthy key say anything about her exam score. */
function countsForForecast(q: Question, state: ReviewState | undefined): boolean {
  return isPractisable(q) && isKeyTrusted(q, state)
}

export type Grade = 'U' | 'G' | 'VG'

export interface Forecast {
  points: number
  max: number
  grade: Grade
  /** Expected share of the exam's points, 0–1. */
  share: number
}

/**
 * "Beräknad poäng 36/50 → G": for each topic, its share of the exam points times her mean
 * recall on exam day over that topic's questions (unseen = 0).
 */
export function forecastScore(
  questions: Question[],
  states: Map<string, ReviewState>,
  examDate: number,
  examInfo: NonNullable<Course['examInfo']>,
): Forecast {
  const pool = questions.filter((q) => countsForForecast(q, states.get(q.id)))
  const weights = topicWeights(questions.filter(isPractisable))
  const byTopic = new Map<string, number[]>()
  for (const q of pool) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), rExam(states.get(q.id), examDate)])
  let share = 0
  for (const [t, w] of weights) {
    const rs = byTopic.get(t)
    if (rs?.length) share += (w * rs.reduce((a, b) => a + b, 0)) / rs.length
  }
  const points = Math.round(share * examInfo.maxPoints)
  return { points, max: examInfo.maxPoints, grade: gradeFor(points, examInfo), share }
}

export function gradeFor(points: number, examInfo: NonNullable<Course['examInfo']>): Grade {
  if (examInfo.distinctionPoints !== undefined && points >= examInfo.distinctionPoints) return 'VG'
  return points >= examInfo.passPoints ? 'G' : 'U'
}

/**
 * The default "Starta plugget" queue: the exam-aware plan while an exam date is ahead,
 * plain FSRS (due first, then new) otherwise, which is also what happens after the exam.
 */
export function dailyQueue(
  input: Omit<DayPlanInput, 'examDate'> & { examDate?: number },
): QueueItem[] {
  const { examDate, questions, states, now, topic } = input
  if (isExamModeActive(examDate, now)) return planDay({ ...input, examDate })
  return buildQueue(questions, states, now, { topic })
}

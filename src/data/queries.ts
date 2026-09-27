import type { Course } from '../content/schema'
import { db, type ReviewState, type StoredQuestion } from '../db/db'
import { isMastered } from '../lib/coverage'
import { retrievability } from '../lib/scheduler'
import { isPractisable } from '../lib/session'
import { startedToday } from '../lib/stats'
import { DEFAULT_MINUTES_PER_DAY, SETTINGS } from './settings'

export interface CourseData {
  course: Course
  questions: StoredQuestion[]
  states: Map<string, ReviewState>
}

export async function loadCourses(): Promise<Course[]> {
  return db.courses.toArray()
}

export async function loadCourseData(courseId: string): Promise<CourseData | undefined> {
  const course = await db.courses.get(courseId)
  if (!course) return undefined
  const [questions, states] = await Promise.all([
    db.questions.where({ courseId }).toArray(),
    db.reviewStates.where({ courseId }).toArray(),
  ])
  return { course, questions, states: new Map(states.map((s) => [s.questionId, s])) }
}

export interface TopicStats {
  topic: string
  total: number
  seen: number
  /** See isMastered: stable for three weeks and checked against a trusted key. */
  mastered: number
  due: number
}

export function topicStats({ questions, states }: CourseData, now: number): TopicStats[] {
  const byTopic = new Map<string, TopicStats>()
  for (const q of questions) {
    if (!isPractisable(q)) continue
    const t = byTopic.get(q.topic) ?? { topic: q.topic, total: 0, seen: 0, mastered: 0, due: 0 }
    t.total++
    const s = states.get(q.id)
    if (s) {
      t.seen++
      if (isMastered(q, s)) t.mastered++
      if (s.due <= now) t.due++
    }
    byTopic.set(q.topic, t)
  }
  return [...byTopic.values()].sort((a, b) => b.total - a.total)
}

/** Mean predicted recall on a given day (the exam) across practisable questions; unseen count as 0. */
export function predictedRecall({ questions, states }: CourseData, at: number): number {
  const pool = questions.filter(isPractisable)
  if (!pool.length) return 0
  const sum = pool.reduce((acc, q) => acc + (states.has(q.id) ? retrievability(states.get(q.id)!.card, at) : 0), 0)
  return sum / pool.length
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return ((await db.settings.get(key))?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

export interface PlanContext {
  examDate?: number
  minutesPerDay: number
  startedToday: number
}

/** Settings and log facts the daily plan needs. */
export async function loadPlanContext(courseId: string, now: number): Promise<PlanContext> {
  const [examDate, minutesPerDay, log] = await Promise.all([
    getSetting<number | undefined>(SETTINGS.examDate(courseId), undefined),
    getSetting(SETTINGS.minutesPerDay, DEFAULT_MINUTES_PER_DAY),
    db.reviewLog.where({ courseId }).toArray(),
  ])
  return { examDate, minutesPerDay, startedToday: startedToday(log, now) }
}

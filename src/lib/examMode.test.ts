import { Rating } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import {
  dailyQueue,
  daysUntil,
  examGain,
  forecastScore,
  gradeFor,
  isExamModeActive,
  newPerDay,
  planDay,
  rExam,
  topicWeights,
} from './examMode'
import { newCard, review } from './scheduler'

const DAY = 86_400_000
const now = Date.UTC(2026, 9, 1, 8)
const examInfo = { maxPoints: 50, passPoints: 30, distinctionPoints: 40, rules: [] }

const q = (id: string, topic: string, extra: Partial<Question> = {}): Question => ({
  id,
  origin: 'exam',
  status: 'approved',
  topic,
  objectiveIds: [],
  type: 'free_text',
  prompt: `Fråga ${id}`,
  answers: [{ provenance: 'official', text: 'svar', sourceId: 's' }],
  ...extra,
})

/** A state learned well: reviewed Good several times, ending at `at`. */
function learned(questionId: string, at: number, times = 4): ReviewState {
  let card = newCard(at - 60 * DAY)
  let t = at - 60 * DAY
  for (let i = 0; i < times; i++) {
    card = review(card, Rating.Good, t)
    t = Math.min(card.due, at)
  }
  return { courseId: 'c', questionId, due: card.due, card }
}

describe('topicWeights', () => {
  it('shares exam points by topic, with a floor for topics never examined', () => {
    const w = topicWeights([
      q('a', 'x', { examId: 'e1', points: 6 }),
      q('b', 'y', { examId: 'e1', points: 2 }),
      q('c', 'z'), // workshop only
    ])
    // raw: x 6, y 2, z 1 (half of 2) → total 9
    expect(w.get('x')).toBeCloseTo(6 / 9)
    expect(w.get('y')).toBeCloseTo(2 / 9)
    expect(w.get('z')).toBeCloseTo(1 / 9)
  })
})

describe('recall on exam day', () => {
  it('is 0 for unseen questions and rises with a review', () => {
    const exam = now + 20 * DAY
    expect(rExam(undefined, exam)).toBe(0)
    expect(examGain(undefined, now, exam)).toBeGreaterThan(0)
  })

  it('gains little from reviewing a question just learned well', () => {
    const exam = now + 5 * DAY
    const fresh = examGain(undefined, now, exam)
    const strong = examGain(learned('a', now), now, exam)
    expect(strong).toBeLessThan(fresh)
  })
})

describe('newPerDay', () => {
  it('spreads new questions evenly over the days until the exam', () => {
    expect(newPerDay(30, now + 10 * DAY, now)).toBe(3)
    expect(newPerDay(31, now + 10 * DAY, now)).toBe(4)
    expect(newPerDay(30, now + 3 * DAY, now)).toBe(10)
    expect(newPerDay(30, now, now)).toBe(30)
    expect(newPerDay(0, now + 30 * DAY, now)).toBe(0)
  })
})

describe('planDay', () => {
  const exam = now + 10 * DAY

  it('fills the time budget, preferring heavily examined topics', () => {
    const questions = [
      ...Array.from({ length: 4 }, (_, i) => q(`big${i}`, 'big', { examId: 'e', points: 10, type: 'mcq', options: [{ id: 'a', text: 'x' }], correct: ['a'] })),
      ...Array.from({ length: 4 }, (_, i) => q(`small${i}`, 'small', { examId: 'e', points: 1, type: 'mcq', options: [{ id: 'a', text: 'x' }], correct: ['a'] })),
    ]
    // 2 minutes = 4 MCQs of 30 s; 8 new, 4 days to pace them → 2 per day.
    const plan = planDay({ questions, states: new Map(), now, examDate: now + 4 * DAY, minutesPerDay: 2 })
    expect(plan).toHaveLength(2)
    expect(plan.every((i) => i.question.topic === 'big')).toBe(true)
  })

  it('keeps introducing new questions right up to the exam', () => {
    const questions = [q('seen', 't', { examId: 'e', points: 2 }), q('new', 't', { examId: 'e', points: 2 })]
    const state = { ...learned('seen', now - DAY, 1), due: now - DAY }
    const plan = planDay({
      questions,
      states: new Map([['seen', state]]),
      now,
      examDate: now + 2 * DAY,
      minutesPerDay: 60,
    })
    expect(plan.map((i) => i.question.id).sort()).toEqual(['new', 'seen'])
  })

  it('counts new questions already started today against the quota', () => {
    const questions = Array.from({ length: 7 }, (_, i) => q(`n${i}`, 't', { examId: 'e' }))
    // 7 questions over 10 days of pacing → 1 per day, and n0 was already started today.
    const states = new Map([['n0', { courseId: 'c', questionId: 'n0', due: now + DAY, card: review(newCard(now), Rating.Good, now) }]])
    const plan = planDay({ questions, states, now, examDate: exam, minutesPerDay: 60, startedToday: 1 })
    expect(plan).toHaveLength(0)
    expect(planDay({ questions, states, now, examDate: exam, minutesPerDay: 60, startedToday: 0 })).toHaveLength(1)
  })

  it('ignores the daily quota for a topic she picks herself', () => {
    const questions = Array.from({ length: 7 }, (_, i) => q(`n${i}`, 't', { examId: 'e' }))
    const states = new Map([['n0', { courseId: 'c', questionId: 'n0', due: now + DAY, card: review(newCard(now), Rating.Good, now) }]])
    const plan = planDay({ questions, states, now, examDate: exam, minutesPerDay: 60, startedToday: 1, topic: 't' })
    expect(plan.length).toBeGreaterThan(0)
  })

  it('filters by topic', () => {
    const questions = [q('a', 'x', { examId: 'e' }), q('b', 'y', { examId: 'e' })]
    const plan = planDay({ questions, states: new Map(), now, examDate: now + 30 * DAY, minutesPerDay: 60, topic: 'y' })
    expect(plan.map((i) => i.question.id)).toEqual(['b'])
  })
})

describe('forecastScore', () => {
  it('is 0/50 → U with nothing learned', () => {
    const f = forecastScore([q('a', 'x', { examId: 'e', points: 5 })], new Map(), now + 10 * DAY, examInfo)
    expect(f).toEqual({ points: 0, max: 50, grade: 'U', share: 0 })
  })

  it('weights recall by topic share and ignores questions without a trusted key', () => {
    const questions = [
      q('a', 'x', { examId: 'e', points: 8 }),
      q('b', 'y', { examId: 'e', points: 2 }),
      q('notes', 'y', { answers: [{ provenance: 'own_notes', text: 'mina anteckningar', sourceId: 's' }] }),
    ]
    const exam = now + 2 * DAY
    const states = new Map([
      ['a', learned('a', now)],
      ['notes', learned('notes', now)],
    ])
    const f = forecastScore(questions, states, exam, examInfo)
    // Only topic x (80 % of points) is known; the own-notes question does not count for y.
    const rA = rExam(states.get('a'), exam)
    expect(f.share).toBeCloseTo(0.8 * rA)
    expect(f.points).toBe(Math.round(0.8 * rA * 50))
  })
})

describe('helpers', () => {
  it('grades against the thresholds', () => {
    expect(gradeFor(29, examInfo)).toBe('U')
    expect(gradeFor(30, examInfo)).toBe('G')
    expect(gradeFor(40, examInfo)).toBe('VG')
    expect(gradeFor(45, { maxPoints: 50, passPoints: 30, rules: [] })).toBe('G')
  })

  it('knows when exam mode is on', () => {
    expect(isExamModeActive(undefined, now)).toBe(false)
    expect(isExamModeActive(now - 1, now)).toBe(false)
    expect(isExamModeActive(now + DAY, now)).toBe(true)
    expect(daysUntil(now + 36 * 3_600_000, now)).toBe(2)
  })
})

describe('dailyQueue', () => {
  it('uses the exam plan before the exam and plain FSRS after it', () => {
    const questions = Array.from({ length: 30 }, (_, i) => q(`n${i}`, 't', { examId: 'e' }))
    const before = dailyQueue({ questions, states: new Map(), now, examDate: now + 13 * DAY, minutesPerDay: 60 })
    expect(before).toHaveLength(3) // 30 new over 10 days
    const after = dailyQueue({ questions, states: new Map(), now, examDate: now - DAY, minutesPerDay: 60 })
    expect(after).toHaveLength(10) // buildQueue's default new limit
  })
})

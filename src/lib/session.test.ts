import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import { buildQueue, interleave, isPractisable } from './session'
import { newCard } from './scheduler'

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

const state = (questionId: string, due: number): ReviewState => ({
  courseId: 'c',
  questionId,
  due,
  card: { ...newCard(0), due, reps: 1 },
})

describe('isPractisable', () => {
  it('needs a key for MCQ and an answer for free text', () => {
    expect(isPractisable(q('a', 't'))).toBe(true)
    expect(isPractisable(q('b', 't', { answers: [] }))).toBe(false)
    expect(isPractisable(q('c', 't', { type: 'mcq', options: [{ id: 'a', text: 'x' }], answers: [] }))).toBe(false)
    expect(
      isPractisable(q('d', 't', { type: 'mcq', options: [{ id: 'a', text: 'x' }], correct: ['a'], answers: [] })),
    ).toBe(true)
  })
})

describe('interleave', () => {
  it('alternates between groups', () => {
    expect(interleave(['a1', 'a2', 'b1', 'c1', 'b2'], (s) => s[0])).toEqual(['a1', 'b1', 'c1', 'a2', 'b2'])
  })
})

describe('buildQueue', () => {
  const questions = [q('q1', 'x'), q('q2', 'x'), q('q3', 'y'), q('q4', 'y'), q('q5', 'x')]

  it('puts overdue reviews first, most overdue first, and skips reviews not yet due', () => {
    const states = new Map([
      ['q1', state('q1', 500)],
      ['q2', state('q2', 100)],
      ['q3', state('q3', 5_000)],
    ])
    const queue = buildQueue(questions, states, 1_000)
    expect(queue.map((i) => i.question.id)).toEqual(['q2', 'q1', 'q4', 'q5'])
  })

  it('interleaves new questions by topic and respects the new-card limit', () => {
    const queue = buildQueue(questions, new Map(), 0, { newLimit: 3 })
    expect(queue.map((i) => i.question.topic)).toEqual(['x', 'y', 'x'])
  })

  it('filters by topic', () => {
    const queue = buildQueue(questions, new Map(), 0, { topic: 'y' })
    expect(queue.every((i) => i.question.topic === 'y')).toBe(true)
  })
})

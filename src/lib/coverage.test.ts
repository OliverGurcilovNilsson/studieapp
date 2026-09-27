import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import { coverage, gapQueue, isMastered } from './coverage'
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
const state = (questionId: string, stability: number): ReviewState => ({
  courseId: 'c',
  questionId,
  due: 0,
  card: { ...newCard(0), stability, reps: 3 },
})
const notesOnly = { answers: [{ provenance: 'own_notes' as const, text: 'anteckning', sourceId: 's' }] }

describe('isMastered', () => {
  it('needs three weeks of stability and a trusted key', () => {
    expect(isMastered(q('a', 't'), state('a', 30))).toBe(true)
    expect(isMastered(q('a', 't'), state('a', 5))).toBe(false)
    expect(isMastered(q('a', 't'), undefined)).toBe(false)
    expect(isMastered(q('n', 't', notesOnly), state('n', 30))).toBe(false)
  })
})

describe('coverage', () => {
  const questions = [
    q('a', 'x', { examId: 'e1' }),
    q('b', 'x', { examId: 'e2' }),
    q('c', 'x', notesOnly),
    q('d', 'y', { examId: 'e1' }),
    q('u', 'y', { answers: [{ provenance: 'student', text: 'delvis', awarded: 1, max: 2, sourceId: 's' }] }),
  ]
  const states = new Map([
    ['a', state('a', 30)],
    ['b', state('b', 2)],
    ['c', state('c', 40)],
  ])

  it('splits each topic into mastered, seen and not started, and counts exams', () => {
    const c = coverage(questions, states, [{ topic: 'x' }, { topic: 'z' }])
    expect(c.examCount).toBe(2)
    expect(c.topics).toEqual([
      { topic: 'x', total: 3, mastered: 1, seen: 2, notStarted: 0, exams: 2, uncertain: 0 },
      { topic: 'y', total: 2, mastered: 0, seen: 0, notStarted: 2, exams: 1, uncertain: 1 },
      { topic: 'z', total: 0, mastered: 0, seen: 0, notStarted: 0, exams: 0, uncertain: 0 },
    ])
    expect([c.mastered, c.total]).toEqual([1, 5])
  })

  it('builds a gap queue from unmastered questions, biggest weighted gap first', () => {
    const queue = gapQueue(questions, states)
    // Both topics have gaps; the mastered question is left out.
    const ids = queue.map((i) => i.question.id)
    expect(ids).not.toContain('a')
    expect(ids.sort()).toEqual(['b', 'c', 'd', 'u'])
    const xOnly = gapQueue(questions.filter((x) => x.topic === 'x'), states).map((i) => i.question.id)
    expect(xOnly).toEqual(['b', 'c']) // least stable first
  })
})

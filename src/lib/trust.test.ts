import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import { newCard } from './scheduler'
import { isKeyTrusted, needsApproval } from './trust'

const q = (extra: Partial<Question>): Question => ({
  id: 'q',
  origin: 'exam',
  status: 'approved',
  topic: 't',
  objectiveIds: [],
  type: 'free_text',
  prompt: 'Fråga',
  answers: [],
  ...extra,
})
const state = (extra: Partial<ReviewState> = {}): ReviewState => ({
  courseId: 'c',
  questionId: 'q',
  due: 0,
  card: newCard(0),
  ...extra,
})

describe('isKeyTrusted', () => {
  it('trusts auto-graded exam questions and official free text', () => {
    expect(isKeyTrusted(q({ type: 'mcq', options: [{ id: 'a', text: 'x' }], correct: ['a'] }), undefined)).toBe(true)
    expect(isKeyTrusted(q({ answers: [{ provenance: 'official', text: 'x', sourceId: 's' }] }), undefined)).toBe(true)
  })

  it('does not trust own notes alone', () => {
    expect(isKeyTrusted(q({ answers: [{ provenance: 'own_notes', text: 'x', sourceId: 's' }] }), state())).toBe(false)
  })

  it('trusts a generated card of any type only once approved', () => {
    const gen = q({
      origin: 'generated',
      status: 'unverified',
      type: 'mcq',
      options: [{ id: 'a', text: 'x' }],
      correct: ['a'],
    })
    expect(isKeyTrusted(gen, undefined)).toBe(false)
    expect(isKeyTrusted(gen, state())).toBe(false)
    expect(isKeyTrusted(gen, state({ approved: true }))).toBe(true)
    expect(needsApproval(gen, state())).toBe(true)
    expect(needsApproval(gen, state({ approved: true }))).toBe(false)
  })
})

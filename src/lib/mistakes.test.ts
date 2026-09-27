import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import { mistakeBank } from './mistakes'
import { newCard } from './scheduler'

const q = (id: string): Question => ({
  id,
  origin: 'exam',
  status: 'approved',
  topic: 't',
  objectiveIds: [],
  type: 'free_text',
  prompt: `Fråga ${id}`,
  answers: [{ provenance: 'official', text: 'svar', sourceId: 's' }],
})
const state = (questionId: string, lapses: number): ReviewState => ({
  courseId: 'c',
  questionId,
  due: 0,
  card: { ...newCard(0), lapses, reps: 5 },
})

describe('mistakeBank', () => {
  const questions = [q('lapsed'), q('again'), q('recovered'), q('fine')]
  const states = new Map([
    ['lapsed', state('lapsed', 2)],
    ['again', state('again', 0)],
    ['recovered', state('recovered', 1)],
    ['fine', state('fine', 0)],
  ])
  const log = [
    { questionId: 'lapsed', ts: 10, rating: 1 as const },
    { questionId: 'lapsed', ts: 20, rating: 3 as const },
    { questionId: 'again', ts: 5, rating: 3 as const },
    { questionId: 'again', ts: 30, rating: 1 as const },
    { questionId: 'recovered', ts: 15, rating: 1 as const },
    { questionId: 'recovered', ts: 40, rating: 3 as const },
    { questionId: 'fine', ts: 50, rating: 4 as const },
  ]

  it('takes two lapses or a latest "Igen", most recent miss first', () => {
    const bank = mistakeBank(questions, states, log)
    expect(bank.map((m) => m.question.id)).toEqual(['again', 'lapsed'])
    expect(bank[0]).toMatchObject({ lastRatedAgain: true, misses: 1, lastMissAt: 30 })
    expect(bank[1]).toMatchObject({ lastRatedAgain: false, lapses: 2 })
  })
})

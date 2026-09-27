import { Rating } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import {
  buildAheadQueue,
  gradeFor,
  isSelfGraded,
  multiOutcome,
  numericOutcome,
  questionLabel,
  summarize,
} from './practice'
import { newCard } from './scheduler'

const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  origin: 'exam',
  status: 'approved',
  topic: 't',
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

describe('grading', () => {
  it('maps outcomes to ratings', () => {
    expect(gradeFor('correct')).toBe(Rating.Good)
    expect(gradeFor('partial')).toBe(Rating.Hard)
    expect(gradeFor('wrong')).toBe(Rating.Again)
  })

  it('treats wrong rounding as wrong and waits on unparseable input', () => {
    expect(numericOutcome({ kind: 'correct' })).toBe('correct')
    expect(numericOutcome({ kind: 'wrong_rounding', expected: '1,0' })).toBe('wrong')
    expect(numericOutcome({ kind: 'unparseable' })).toBeUndefined()
  })

  it('scores multi-select outcomes', () => {
    expect(multiOutcome(2, 2)).toBe('correct')
    expect(multiOutcome(1, 2)).toBe('partial')
    expect(multiOutcome(0, 2)).toBe('wrong')
  })

  it('self-grades text types and calculations without a numeric key', () => {
    expect(isSelfGraded(q('a'))).toBe(true)
    expect(isSelfGraded(q('b', { type: 'mcq' }))).toBe(false)
    expect(isSelfGraded(q('c', { type: 'calculation', numeric: { value: 1 } }))).toBe(false)
    expect(isSelfGraded(q('d', { type: 'calculation' }))).toBe(true)
  })
})

describe('summarize', () => {
  it('counts each question once, by its latest result', () => {
    const s = summarize([
      { questionId: 'a', grade: Rating.Again },
      { questionId: 'b', grade: Rating.Good, outcome: 'correct' },
      { questionId: 'c', grade: Rating.Hard, outcome: 'correct' }, // a correct guess is still a miss
      { questionId: 'a', grade: Rating.Easy },
    ])
    expect(s).toEqual({ total: 3, right: 2, missed: ['c'] })
  })
})

describe('buildAheadQueue', () => {
  it('takes reviewed questions by due date and never new ones', () => {
    const states = new Map([
      ['q2', state('q2', 300)],
      ['q1', state('q1', 200)],
    ])
    const queue = buildAheadQueue([q('q1'), q('q2'), q('q3')], states)
    expect(queue.map((i) => i.question.id)).toEqual(['q1', 'q2'])
  })
})

describe('questionLabel', () => {
  it('joins topic, type and points', () => {
    expect(questionLabel(q('a', { points: 1.5 }), (t) => t.toUpperCase())).toBe('T · Fritext · 1,5 p')
    expect(questionLabel(q('a', { type: 'mcq' }), (t) => t)).toBe('t · Flerval')
    expect(questionLabel(q('a', { type: 'article_review' }), () => 'Artikelgranskning')).toBe('Artikelgranskning')
  })
})

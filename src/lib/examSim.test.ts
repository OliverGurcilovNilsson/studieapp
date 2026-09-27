import { describe, expect, it } from 'vitest'
import type { Question } from '../content/schema'
import {
  autoScore,
  elapsed,
  EXAM_DURATION_MS,
  formatClock,
  isAnswered,
  paperOrder,
  pause,
  questionHeading,
  remaining,
  resume,
  scoreExam,
  thresholds,
  weakest,
} from './examSim'

const official = [{ provenance: 'official' as const, text: 'svar', sourceId: 's' }]
const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  origin: 'exam',
  status: 'approved',
  examId: 'e',
  topic: 't',
  objectiveIds: [],
  type: 'free_text',
  prompt: `Fråga ${id}`,
  answers: official,
  ...extra,
})
const opts = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
  { id: 'c', text: 'C' },
]
const mcq = q('m', { number: '1', type: 'mcq', points: 1, options: opts, correct: ['b'] })
const multi = q('mm', { number: '2', type: 'mcq_multi', points: 2, options: opts, correct: ['a', 'b'], negativeMarking: true })
const calc = q('c', { number: '3a', type: 'calculation', points: 2, numeric: { value: 12.345, decimals: 1 }, topic: 'räkna' })
const text = q('f', { number: '10', points: 4, topic: 'skriva' })
const art = q('art', { number: '1', part: 'article', type: 'article_review', points: 3, topic: 'skriva' })
const examInfo = { maxPoints: 50, passPoints: 30, distinctionPoints: 40, rules: [] }

describe('clock', () => {
  it('counts only running time and survives pause/resume', () => {
    let c = resume({ elapsedMs: 0 }, 1_000)
    expect(elapsed(c, 4_000)).toBe(3_000)
    c = pause(c, 4_000)
    expect(elapsed(c, 100_000)).toBe(3_000)
    c = resume(c, 100_000)
    expect(remaining(c, 101_000)).toBe(EXAM_DURATION_MS - 4_000)
    expect(remaining({ elapsedMs: EXAM_DURATION_MS + 5 }, 0)).toBe(0)
  })

  it('formats as h:mm:ss', () => {
    expect(formatClock(EXAM_DURATION_MS)).toBe('4:00:00')
    expect(formatClock(61_500)).toBe('0:01:02')
  })
})

describe('paperOrder', () => {
  it('sorts by number naturally, with the article part last', () => {
    const order = paperOrder([art, text, calc, multi, mcq, q('other', { examId: 'x' })], 'e')
    expect(order.map((x) => x.id)).toEqual(['m', 'mm', 'c', 'f', 'art'])
  })
})

describe('autoScore', () => {
  it('scores the objective types and leaves free text to her', () => {
    expect(autoScore(mcq, { choice: 'b' })).toBe(1)
    expect(autoScore(mcq, { choice: 'a' })).toBe(0)
    expect(autoScore(mcq, undefined)).toBe(0)
    expect(autoScore(multi, { selected: ['a', 'c'] })).toBe(0)
    expect(autoScore(multi, { selected: ['a'] })).toBe(1)
    expect(autoScore(calc, { input: '12,3' })).toBe(2)
    expect(autoScore(calc, { input: '12,35' })).toBe(0) // wrong rounding
    expect(autoScore(text, { text: 'x' })).toBeUndefined()
  })
})

describe('scoreExam', () => {
  it('adds auto and self scores, groups them and lists misses', () => {
    const r = scoreExam(
      [mcq, multi, calc, text, art],
      { m: { choice: 'b' }, mm: { selected: ['a', 'b'] }, c: { input: '12,4' } },
      { f: 3, art: 9 }, // a self score above max is capped
      examInfo,
    )
    expect(r.total).toBe(1 + 2 + 0 + 3 + 3)
    expect(r.max).toBe(12)
    expect(r.missed).toEqual(['c', 'f'])
    expect(r.parts).toEqual([
      { label: 'Begrepp och beräkningar', points: 6, max: 9 },
      { label: 'Artikelgranskning', points: 3, max: 3 },
    ])
    expect(r.types.find((t) => t.label === 'Beräkning')).toEqual({ label: 'Beräkning', points: 0, max: 2 })
    expect(weakest(r)).toEqual(['Räkna'])
    // 12 p paper: G from 7.2 → 7, VG from 9.6 → 9.5
    expect([r.passAt, r.distinctionAt, r.grade]).toEqual([7, 9.5, 'G'])
  })
})

describe('thresholds', () => {
  it('uses the real limits for a full paper and 60 % without exam info', () => {
    expect(thresholds(examInfo, 50)).toEqual({ passAt: 30, distinctionAt: 40 })
    expect(thresholds(undefined, 20)).toEqual({ passAt: 12 })
  })
})

describe('helpers', () => {
  it('knows an empty answer from a real one', () => {
    expect(isAnswered(undefined)).toBe(false)
    expect(isAnswered({ text: '  ' })).toBe(false)
    expect(isAnswered({ selected: [] })).toBe(false)
    expect(isAnswered({ input: '1,5' })).toBe(true)
  })

  it('labels a question like the paper', () => {
    expect(questionHeading(calc)).toBe('Fråga 3a · Räkna · 2 p')
  })
})

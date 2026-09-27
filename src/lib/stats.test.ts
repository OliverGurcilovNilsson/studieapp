import { describe, expect, it } from 'vitest'
import { learnedThisWeek, streakDays } from './stats'

const at = (d: number, h = 12) => new Date(2026, 8, d, h).getTime() // September 2026, local time

describe('learnedThisWeek', () => {
  it('counts distinct questions from the last 7 days', () => {
    const log = [
      { courseId: 'c', questionId: 'a', ts: at(20) },
      { courseId: 'c', questionId: 'a', ts: at(21) },
      { courseId: 'c', questionId: 'b', ts: at(26) },
      { courseId: 'c', questionId: 'old', ts: at(10) },
    ]
    expect(learnedThisWeek(log, at(26, 18))).toBe(2)
  })
})

describe('streakDays', () => {
  it('counts consecutive days ending today', () => {
    expect(streakDays([at(24), at(25), at(26, 8), at(26, 20)], at(26, 21))).toBe(3)
  })

  it('keeps a streak that ended yesterday, and breaks on a gap', () => {
    expect(streakDays([at(24), at(25)], at(26, 9))).toBe(2)
    expect(streakDays([at(23), at(25)], at(26, 9))).toBe(1)
    expect(streakDays([at(20)], at(26))).toBe(0)
    expect(streakDays([], at(26))).toBe(0)
  })
})

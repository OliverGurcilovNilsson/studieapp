import { Rating } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { newCard, previewIntervals, retrievability, review } from './scheduler'

const DAY = 86_400_000
const t0 = Date.UTC(2026, 9, 1, 8)

/** Reviews a card rated Good several times, each time when it falls due. */
function learn(times: number, examDate?: number) {
  let card = newCard(t0)
  let now = t0
  for (let i = 0; i < times; i++) {
    card = review(card, Rating.Good, now, { examDate })
    now = card.due
  }
  return card
}

describe('review', () => {
  it('schedules further out after repeated successes', () => {
    const card = learn(5)
    expect(card.due - card.last_review!).toBeGreaterThan(7 * DAY)
  })

  it('brings every card back by the day before the exam', () => {
    const examDate = t0 + 10 * DAY
    let card = newCard(t0)
    let now = t0
    for (let i = 0; i < 4; i++) {
      card = review(card, Rating.Easy, now, { examDate })
      expect(card.due).toBeLessThanOrEqual(Math.max(now + 3_600_000, examDate - DAY))
      now = card.due
    }
  })

  it('ignores an exam date that has passed', () => {
    const passed = review(newCard(t0), Rating.Easy, t0, { examDate: t0 - DAY })
    expect(passed).toEqual(review(newCard(t0), Rating.Easy, t0))
  })

  it('treats a guessed correct answer as Hard', () => {
    const base = learn(2)
    const now = base.due
    const guessed = review(base, Rating.Good, now, { guessed: true })
    const hard = review(base, Rating.Hard, now)
    const sure = review(base, Rating.Good, now)
    expect(guessed.due).toBe(hard.due)
    expect(guessed.due).toBeLessThan(sure.due)
  })
})

describe('previewIntervals', () => {
  it('gives increasing intervals from Igen to Lätt', () => {
    const p = previewIntervals(learn(3), learn(3).due)
    expect(Object.keys(p)).toHaveLength(4)
    expect(p[Rating.Again]).toMatch(/min|h/)
  })
})

describe('retrievability', () => {
  it('is 0 for new cards and falls over time', () => {
    expect(retrievability(newCard(t0), t0)).toBe(0)
    const card = learn(3)
    const soon = retrievability(card, card.last_review! + DAY)
    const later = retrievability(card, card.last_review! + 60 * DAY)
    expect(soon).toBeGreaterThan(later)
    expect(soon).toBeLessThanOrEqual(1)
  })
})

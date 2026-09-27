import 'fake-indexeddb/auto'
import { Rating } from 'ts-fsrs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StudyDb } from '../db/db'
import { saveReview } from './review'

const DAY = 86_400_000
let db: StudyDb
beforeEach(() => {
  db = new StudyDb(`review-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('saveReview', () => {
  it('creates a state for a new question and logs the rating', async () => {
    const s = await saveReview(db, { courseId: 'c', questionId: 'q1', grade: Rating.Good, now: 1_000, durationMs: 5_000 })
    expect(s.card.reps).toBe(1)
    expect(await db.reviewStates.get(['c', 'q1'])).toEqual(s)
    const log = await db.reviewLog.toArray()
    expect(log).toMatchObject([{ courseId: 'c', questionId: 'q1', ts: 1_000, rating: Rating.Good, durationMs: 5_000 }])
    expect(log[0].guessed).toBeUndefined()
  })

  it('updates an existing state, keeps flags like approved, and records guesses', async () => {
    const first = await saveReview(db, { courseId: 'c', questionId: 'q1', grade: Rating.Good, now: 0 })
    await db.reviewStates.update(['c', 'q1'], { approved: true })
    const again = await saveReview(db, {
      courseId: 'c',
      questionId: 'q1',
      state: { ...first, approved: true },
      grade: Rating.Easy,
      guessed: true,
      now: first.due,
    })
    expect(again.approved).toBe(true)
    expect(again.card.reps).toBe(2)
    expect(await db.reviewLog.count()).toBe(2)
    expect((await db.reviewLog.toArray())[1].guessed).toBe(true)
  })

  it('never schedules past the day before the exam', async () => {
    const examDate = 5 * DAY
    const s = await saveReview(db, { courseId: 'c', questionId: 'q1', grade: Rating.Easy, now: 0, examDate })
    expect(s.due).toBeLessThanOrEqual(examDate - DAY)
  })
})

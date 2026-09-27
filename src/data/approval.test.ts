import 'fake-indexeddb/auto'
import { Rating } from 'ts-fsrs'
import { afterEach, describe, expect, it } from 'vitest'
import { StudyDb } from '../db/db'
import { setCardVerdict } from './approval'
import { saveReview } from './review'

const db = new StudyDb(`test-${crypto.randomUUID()}`)
afterEach(async () => {
  await db.reviewStates.clear()
  await db.reviewLog.clear()
})

describe('setCardVerdict', () => {
  it('keeps the approval when the card is rated afterwards with a stale snapshot', async () => {
    const snapshot = undefined // the question opened before she approved it
    await setCardVerdict('c', 'gen-1', 'approved', db, 0)
    await saveReview(db, { courseId: 'c', questionId: 'gen-1', state: snapshot, grade: Rating.Good, now: 1000 })
    const s = await db.reviewStates.get(['c', 'gen-1'])
    expect(s?.approved).toBe(true)
    expect(s?.card.reps).toBe(1)
  })

  it('marks a reported card as rejected and not approved', async () => {
    await setCardVerdict('c', 'gen-2', 'rejected', db, 0)
    const s = await db.reviewStates.get(['c', 'gen-2'])
    expect(s).toMatchObject({ rejected: true, approved: false })
  })
})

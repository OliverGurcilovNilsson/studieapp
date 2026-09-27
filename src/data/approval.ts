import { db, type StudyDb } from '../db/db'
import { newCard } from '../lib/scheduler'

/**
 * Records her verdict on an AI-generated card. Stored on the review state (progress), so it
 * survives re-imports. A card without a state gets a fresh one; rating it later keeps the flag.
 */
export async function setCardVerdict(
  courseId: string,
  questionId: string,
  verdict: 'approved' | 'rejected',
  database: StudyDb = db,
  now = Date.now(),
) {
  await database.transaction('rw', database.reviewStates, async () => {
    const existing = await database.reviewStates.get([courseId, questionId])
    const base = existing ?? { courseId, questionId, due: now, card: newCard(now) }
    await database.reviewStates.put({
      ...base,
      approved: verdict === 'approved',
      rejected: verdict === 'rejected' ? true : undefined,
    })
  })
}

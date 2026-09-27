import type { Grade } from 'ts-fsrs'
import type { ReviewState, StudyDb } from '../db/db'
import { newCard, review } from '../lib/scheduler'

export interface SaveReviewInput {
  courseId: string
  questionId: string
  state?: ReviewState
  grade: Grade
  guessed?: boolean
  now: number
  examDate?: number
  durationMs?: number
}

/** Schedules the card and writes the new state and the log entry in one transaction. */
export async function saveReview(db: StudyDb, input: SaveReviewInput): Promise<ReviewState> {
  const { courseId, questionId, state, grade, guessed, now, examDate, durationMs } = input
  let next!: ReviewState
  await db.transaction('rw', db.reviewStates, db.reviewLog, async () => {
    // Read the stored state, not the caller's snapshot: she may have approved the card
    // (setCardVerdict) after the question opened, and that flag must survive the rating.
    const current = (await db.reviewStates.get([courseId, questionId])) ?? state
    const card = review(current?.card ?? newCard(now), grade, now, { guessed, examDate })
    next = { ...current, courseId, questionId, due: card.due, card }
    await db.reviewStates.put(next)
    await db.reviewLog.add({ courseId, questionId, ts: now, rating: grade, ...(guessed ? { guessed } : {}), durationMs })
  })
  return next
}

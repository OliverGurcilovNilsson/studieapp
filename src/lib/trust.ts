// When may a question's key be believed? Pure functions shared by coverage, forecast and the UI.
import { hasTrustedAnswer, type Question } from '../content/schema'
import type { ReviewState } from '../db/db'
import { isSelfGraded } from './practice'

/** AI-generated from lecture slides: not trusted until she approves it. */
export function isGenerated(q: Pick<Question, 'origin'>): boolean {
  return q.origin === 'generated'
}

export function needsApproval(q: Pick<Question, 'origin'>, state: ReviewState | undefined): boolean {
  return isGenerated(q) && !state?.approved
}

/**
 * The key can be believed: for a generated card only once she approved it (whatever its type);
 * otherwise auto-graded questions are trusted, and self-graded ones need an official or full-mark answer.
 */
export function isKeyTrusted(q: Question, state: ReviewState | undefined): boolean {
  if (isGenerated(q)) return !!state?.approved
  return !isSelfGraded(q) || hasTrustedAnswer(q)
}

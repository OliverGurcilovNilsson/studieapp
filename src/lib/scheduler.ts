import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs'
import type { StoredCard } from '../db/db'

const DAY = 86_400_000

export const RATINGS = [
  { grade: Rating.Again, label: 'Igen', key: '1' },
  { grade: Rating.Hard, label: 'Svår', key: '2' },
  { grade: Rating.Good, label: 'Bra', key: '3' },
  { grade: Rating.Easy, label: 'Lätt', key: '4' },
] as const

export function toStored(card: Card): StoredCard {
  return {
    ...card,
    due: card.due.getTime(),
    last_review: card.last_review?.getTime(),
  }
}

export function fromStored(s: StoredCard): Card {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined }
}

export function newCard(now: number): StoredCard {
  return toStored(createEmptyCard(new Date(now)))
}

/**
 * Days until the exam, floored at 1. With an exam date, no interval may pass the exam,
 * so everything she has learned comes back at least once before it.
 */
function maxIntervalDays(now: number, examDate?: number): number | undefined {
  if (examDate === undefined || examDate <= now) return undefined
  return Math.max(1, Math.floor((examDate - now) / DAY))
}

function scheduler(now: number, examDate?: number) {
  const max = maxIntervalDays(now, examDate)
  return fsrs(generatorParameters({ enable_fuzz: false, ...(max ? { maximum_interval: max } : {}) }))
}

/**
 * Applies one rating. A correct answer she marked as a guess counts as "Svår" at most,
 * so it comes back sooner (the plan's confidence rule).
 */
export function review(card: StoredCard, grade: Grade, now: number, opts: { guessed?: boolean; examDate?: number } = {}): StoredCard {
  const effective = opts.guessed && grade > Rating.Hard ? Rating.Hard : grade
  const next = toStored(scheduler(now, opts.examDate).next(fromStored(card), new Date(now), effective).card)
  return capBeforeExam(next, now, opts.examDate)
}

/**
 * ts-fsrs keeps Easy > Good > Hard even when that exceeds maximum_interval, so near the exam
 * the cap is enforced here: every card is due again no later than the day before the exam
 * (the "last touch before the test" from the spacing research).
 */
function capBeforeExam(card: StoredCard, now: number, examDate?: number): StoredCard {
  if (examDate === undefined || examDate <= now) return card
  const latest = Math.max(now + 3_600_000, examDate - DAY)
  if (card.due <= latest) return card
  return { ...card, due: latest, scheduled_days: Math.max(0, Math.round((latest - now) / DAY)) }
}

/** Next interval for each rating, for the labels under the buttons ("10 min", "3 d"). */
export function previewIntervals(card: StoredCard, now: number, examDate?: number): Record<Grade, string> {
  const preview = scheduler(now, examDate).repeat(fromStored(card), new Date(now))
  const fmt = (due: Date) => {
    const ms = due.getTime() - now
    if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`
    if (ms < DAY) return `${Math.round(ms / 3_600_000)} h`
    return `${Math.round(ms / DAY)} d`
  }
  return {
    [Rating.Again]: fmt(preview[Rating.Again].card.due),
    [Rating.Hard]: fmt(preview[Rating.Hard].card.due),
    [Rating.Good]: fmt(preview[Rating.Good].card.due),
    [Rating.Easy]: fmt(preview[Rating.Easy].card.due),
  } as Record<Grade, string>
}

/** Probability she recalls the card at `at` (FSRS retrievability). New cards count as 0. */
export function retrievability(card: StoredCard, at: number): number {
  if (card.reps === 0) return 0
  return scheduler(at).get_retrievability(fromStored(card), new Date(at), false)
}

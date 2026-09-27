const DAY = 86_400_000

/** Local calendar day number, so a streak follows her clock rather than UTC. */
function dayIndex(ts: number): number {
  const d = new Date(ts)
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY)
}

/** Distinct questions she has reviewed in the last 7 days ("Lärt denna vecka"). */
export function learnedThisWeek(log: { questionId: string; courseId: string; ts: number }[], now: number): number {
  return new Set(log.filter((e) => e.ts > now - 7 * DAY && e.ts <= now).map((e) => `${e.courseId}|${e.questionId}`)).size
}

/**
 * Consecutive days with at least one review, ending today. A streak that ended yesterday
 * still counts (today is not over yet).
 */
export function streakDays(timestamps: number[], now: number): number {
  const days = new Set(timestamps.map(dayIndex))
  let day = dayIndex(now)
  if (!days.has(day)) day--
  let streak = 0
  while (days.has(day)) {
    streak++
    day--
  }
  return streak
}

// Setting keys, in one place. Values live in the `settings` table.
export const SETTINGS = {
  examDate: (courseId: string) => `examDate:${courseId}`,
  minutesPerDay: 'minutesPerDay',
  theme: 'theme',
  lastBackupAt: 'lastBackupAt',
  persistRequested: 'persistRequested',
} as const

export const DEFAULT_MINUTES_PER_DAY = 30

/** Exams start in the morning: an exam date is stored as 08:00 local time that day (epoch ms). */
export function examDateFromInput(value: string): number | undefined {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 8).getTime()
}

export function examDateToInput(epoch?: number): string {
  if (epoch === undefined) return ''
  const d = new Date(epoch)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

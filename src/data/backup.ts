import type { ReviewLogEntry, ReviewState, StudyDb } from '../db/db'

export const BACKUP_FORMAT = 'studieapp-backup'
export const BACKUP_VERSION = 1
export const BACKUP_INTERVAL_DAYS = 7
const DAY = 86_400_000

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: number
  /** Dexie schema version the backup was taken from. */
  dbVersion: number
  /** Every table, rows as stored; asset blobs are base64 in `data`. */
  tables: Record<string, unknown[]>
}

export class BackupError extends Error {}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Everything in the database, content included, so a backup alone can rebuild the app. */
export async function exportBackup(db: StudyDb, now = Date.now()): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const table of db.tables) {
      const rows = await table.toArray()
      tables[table.name] =
        table.name === 'assets'
          ? await Promise.all(
              rows.map(async ({ blob, ...rest }: { blob: Blob }) => ({ ...rest, data: await blobToBase64(blob) })),
            )
          : rows
    }
  })
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, dbVersion: db.verno, tables }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `studieapp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export function parseBackup(json: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new BackupError('Filen är inte giltig JSON.')
  }
  const b = data as Partial<BackupFile>
  if (b?.format !== BACKUP_FORMAT) throw new BackupError('Filen är ingen säkerhetskopia från Studieappen.')
  if (b.version !== BACKUP_VERSION) throw new BackupError(`Säkerhetskopian har version ${b.version}, appen förstår ${BACKUP_VERSION}.`)
  if (!b.tables || !Array.isArray(b.tables.reviewStates) || !Array.isArray(b.tables.reviewLog))
    throw new BackupError('Säkerhetskopian saknar framsteg.')
  return b as BackupFile
}

export interface RestoreResult {
  states: number
  logEntries: number
}

const lastReview = (s: ReviewState) => s.card.last_review ?? 0
const logKey = (e: ReviewLogEntry) => `${e.courseId}|${e.questionId}|${e.ts}`

/**
 * Restores PROGRESS only (reviewStates, reviewLog), as a merge that never loses anything:
 * a state is taken from the backup only when it is newer than what is here, and log
 * entries are added when missing. Content always comes from "Importera kurs".
 */
export async function restoreProgress(db: StudyDb, backup: BackupFile): Promise<RestoreResult> {
  const states = backup.tables.reviewStates as ReviewState[]
  const log = backup.tables.reviewLog as ReviewLogEntry[]
  return db.transaction('rw', db.reviewStates, db.reviewLog, async () => {
    const current = new Map((await db.reviewStates.toArray()).map((s) => [`${s.courseId}|${s.questionId}`, s]))
    const newer = states.filter((s) => {
      const here = current.get(`${s.courseId}|${s.questionId}`)
      return !here || lastReview(s) > lastReview(here)
    })
    await db.reviewStates.bulkPut(newer)

    const seen = new Set((await db.reviewLog.toArray()).map(logKey))
    const missing = log.filter((e) => !seen.has(logKey(e))).map(({ id: _id, ...e }) => e)
    await db.reviewLog.bulkAdd(missing)
    return { states: newer.length, logEntries: missing.length }
  })
}

/** Weekly reminder: due when she has progress and has not exported for a week. */
export function backupReminderDue(lastBackupAt: number | undefined, hasProgress: boolean, now: number): boolean {
  if (!hasProgress) return false
  return lastBackupAt === undefined || now - lastBackupAt >= BACKUP_INTERVAL_DAYS * DAY
}

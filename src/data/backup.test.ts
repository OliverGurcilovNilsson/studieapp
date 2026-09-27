import 'fake-indexeddb/auto'
import { Rating } from 'ts-fsrs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StudyDb } from '../db/db'
import { backupReminderDue, BackupError, exportBackup, parseBackup, restoreProgress } from './backup'
import { saveReview } from './review'

const DAY = 86_400_000
let db: StudyDb
beforeEach(() => {
  db = new StudyDb(`backup-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

async function roundTrip() {
  return parseBackup(JSON.stringify(await exportBackup(db)))
}

describe('exportBackup', () => {
  it('includes every table and encodes asset blobs', async () => {
    await db.assets.put({ courseId: 'c', id: 'fig', mime: 'image/png', blob: new Blob(['påhittad bild']) })
    await saveReview(db, { courseId: 'c', questionId: 'q1', grade: Rating.Good, now: 0 })
    const backup = await roundTrip()
    expect(Object.keys(backup.tables).sort()).toEqual(db.tables.map((t) => t.name).sort())
    const asset = backup.tables.assets[0] as { data: string; blob?: unknown }
    expect(asset.blob).toBeUndefined()
    expect(new TextDecoder().decode(Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0)))).toBe('påhittad bild')
    expect(backup.tables.reviewStates).toHaveLength(1)
    expect(backup.dbVersion).toBe(db.verno)
  })
})

describe('parseBackup', () => {
  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError)
    expect(() => parseBackup('{"format":"studieapp-course"}')).toThrow(BackupError)
  })
})

describe('restoreProgress', () => {
  it('restores progress into an empty database', async () => {
    await saveReview(db, { courseId: 'c', questionId: 'q1', grade: Rating.Good, now: 0 })
    const backup = await roundTrip()
    await db.reviewStates.clear()
    await db.reviewLog.clear()
    expect(await restoreProgress(db, backup)).toEqual({ states: 1, logEntries: 1 })
    expect(await db.reviewStates.get(['c', 'q1'])).toEqual(backup.tables.reviewStates[0])
  })

  it('never replaces newer progress with older, and does not duplicate the log', async () => {
    const first = await saveReview(db, { courseId: 'c', questionId: 'q1', grade: Rating.Good, now: 0 })
    const backup = await roundTrip()
    const later = await saveReview(db, { courseId: 'c', questionId: 'q1', state: first, grade: Rating.Good, now: first.due + DAY })
    const result = await restoreProgress(db, backup)
    expect(result).toEqual({ states: 0, logEntries: 0 })
    expect((await db.reviewStates.get(['c', 'q1']))!.card).toEqual(later.card)
    expect(await db.reviewLog.count()).toBe(2)
  })
})

describe('backupReminderDue', () => {
  it('reminds weekly once there is progress', () => {
    expect(backupReminderDue(undefined, false, 0)).toBe(false)
    expect(backupReminderDue(undefined, true, 0)).toBe(true)
    expect(backupReminderDue(0, true, 6 * DAY)).toBe(false)
    expect(backupReminderDue(0, true, 7 * DAY)).toBe(true)
  })
})

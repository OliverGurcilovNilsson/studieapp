import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { newCard } from '../lib/scheduler'
import { LATEST_VERSION, PROGRESS_TABLES, SCHEMA, StudyDb } from './db'
import { openAt, upgradeFrom } from './migrationHarness'
import { KEEP_SNAPSHOTS, SnapshotDb, snapshotBeforeUpgrade } from './preUpgradeSnapshot'

/**
 * One test per schema version after 1. Seed rows in the OLD shape with `upgradeFrom(name,
 * version - 1, seed)` and assert the new shape. The suite fails until a new version has one.
 *
 * Example for a future v2 that adds `reviewStates.flagged`:
 *   2: async (name) => {
 *     const db = await upgradeFrom(name, 1, (old) => old.reviewStates.put(...))
 *     expect((await db.reviewStates.toArray())[0].flagged).toBe(false)
 *     db.close()
 *   },
 */
const MIGRATION_TESTS: Record<number, (dbName: string) => Promise<void>> = {}

const names: string[] = []
const fresh = () => {
  const n = `migration-${crypto.randomUUID()}`
  names.push(n)
  return n
}
afterEach(async () => {
  await Promise.all(names.splice(0).map((n) => Dexie.delete(n)))
})

/** Made-up progress, in the shape every version so far has kept. */
async function seedProgress(db: StudyDb) {
  await db.reviewStates.put({ courseId: 'c', questionId: 'q1', due: 5, card: { ...newCard(0), reps: 2, stability: 12 } })
  await db.reviewLog.bulkAdd([
    { courseId: 'c', questionId: 'q1', ts: 1, rating: 3 },
    { courseId: 'c', questionId: 'q1', ts: 2, rating: 1, guessed: true },
  ])
  await db.settings.put({ key: 'examDate:c', value: 123 })
}

describe('schema versions', () => {
  it('increase, and the app opens at the latest', async () => {
    const versions = SCHEMA.map((v) => v.version)
    expect(versions).toEqual([...versions].sort((a, b) => a - b))
    expect(new Set(versions).size).toBe(versions.length)
    const db = new StudyDb(fresh())
    await db.open()
    expect(db.verno).toBe(LATEST_VERSION)
    db.close()
  })

  it('each version after the first has its own migration test', () => {
    for (const v of SCHEMA.slice(1)) expect(MIGRATION_TESTS, `add MIGRATION_TESTS[${v.version}]`).toHaveProperty(String(v.version))
  })

  it('never drop a progress table', () => {
    for (const v of SCHEMA) for (const t of PROGRESS_TABLES) expect(v.stores[t], `v${v.version} drops ${t}`).not.toBeNull()
  })

  for (const { version } of SCHEMA)
    it(`keep progress when upgrading from v${version} to v${LATEST_VERSION}`, async () => {
      const name = fresh()
      const db = await upgradeFrom(name, version, seedProgress)
      expect(await db.reviewStates.toArray()).toMatchObject([{ questionId: 'q1', card: { reps: 2, stability: 12 } }])
      expect((await db.reviewLog.orderBy('ts').toArray()).map((e) => [e.ts, e.rating, e.guessed])).toEqual([
        [1, 3, undefined],
        [2, 1, true],
      ])
      expect(await db.settings.get('examDate:c')).toEqual({ key: 'examDate:c', value: 123 })
      db.close()
    })
})

// Declared only once there is a version 2 (an empty suite is an error in Vitest).
if (Object.keys(MIGRATION_TESTS).length)
  describe('migrations', () => {
    for (const [version, test] of Object.entries(MIGRATION_TESTS)) it(`to v${version}`, () => test(fresh()))
  })

describe('snapshotBeforeUpgrade', () => {
  it('copies the old database when the schema is about to change', async () => {
    const name = fresh()
    const snapName = fresh()
    await openAt(name, 1, seedProgress)
    const snap = await snapshotBeforeUpgrade(name, 2, new SnapshotDb(snapName), 1_000)
    expect(snap).toMatchObject({ dbName: name, fromVersion: 1, toVersion: 2, takenAt: 1_000 })
    expect(snap!.tables.reviewLog).toHaveLength(2)
    expect(await new SnapshotDb(snapName).snapshots.count()).toBe(1)
  })

  it('does nothing for a new install or an up-to-date database', async () => {
    const snaps = new SnapshotDb(fresh())
    expect(await snapshotBeforeUpgrade(fresh(), 2, snaps)).toBeUndefined()
    const name = fresh()
    await openAt(name, LATEST_VERSION)
    expect(await snapshotBeforeUpgrade(name, LATEST_VERSION, snaps)).toBeUndefined()
    expect(await snaps.snapshots.count()).toBe(0)
  })

  it(`keeps only the newest ${KEEP_SNAPSHOTS}`, async () => {
    const name = fresh()
    const snapName = fresh()
    await openAt(name, 1, seedProgress)
    for (let i = 0; i < KEEP_SNAPSHOTS + 2; i++) await snapshotBeforeUpgrade(name, 2, new SnapshotDb(snapName), i)
    const kept = await new SnapshotDb(snapName).snapshots.orderBy('takenAt').toArray()
    expect(kept.map((s) => s.takenAt)).toEqual([2, 3, 4])
  })
})

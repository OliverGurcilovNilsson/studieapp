import Dexie from 'dexie'
import { LATEST_VERSION } from './db'

/** A copy of the whole database as it was before a schema upgrade. */
export interface Snapshot {
  id?: number
  dbName: string
  fromVersion: number
  toVersion: number
  takenAt: number
  tables: Record<string, unknown[]>
}

/** Kept in its own database, so a failed upgrade of the main one cannot touch it. */
export class SnapshotDb extends Dexie {
  snapshots!: Dexie.Table<Snapshot, number>
  constructor(name = 'studieapp-snapshots') {
    super(name)
    this.version(1).stores({ snapshots: '++id, dbName, takenAt' })
  }
}

export const KEEP_SNAPSHOTS = 3

/**
 * Before the app opens its database with a newer schema, copies every table of the existing
 * one (opened without a schema, as it is on disk) into the snapshot database. Returns the
 * snapshot, or undefined when there is nothing to upgrade.
 */
export async function snapshotBeforeUpgrade(
  dbName = 'studieapp',
  toVersion = LATEST_VERSION,
  snapshots = new SnapshotDb(),
  now = Date.now(),
): Promise<Snapshot | undefined> {
  if (!(await Dexie.exists(dbName))) return undefined
  const old = new Dexie(dbName)
  try {
    await old.open()
    if (old.verno >= toVersion) return undefined
    const tables: Record<string, unknown[]> = {}
    for (const t of old.tables) tables[t.name] = await t.toArray()
    const snap: Snapshot = { dbName, fromVersion: old.verno, toVersion, takenAt: now, tables }
    snap.id = await snapshots.snapshots.add(snap)
    const all = await snapshots.snapshots.where({ dbName }).sortBy('takenAt')
    await snapshots.snapshots.bulkDelete(all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS)).map((s) => s.id!))
    return snap
  } finally {
    old.close()
  }
}

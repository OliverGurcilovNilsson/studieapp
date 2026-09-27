// Test helpers for schema migrations (see migrations.test.ts). Not used by the app.
import { StudyDb } from './db'

/** Creates the database as it looked at `version` and fills it with old-shape rows. */
export async function openAt(name: string, version: number, seed?: (db: StudyDb) => Promise<void>): Promise<void> {
  const old = new StudyDb(name, { upTo: version })
  await old.open()
  if (seed) await seed(old)
  old.close()
}

/** Seeds at `from`, then opens with the current schema, which runs every upgrade since. */
export async function upgradeFrom(name: string, from: number, seed: (db: StudyDb) => Promise<void>): Promise<StudyDb> {
  await openAt(name, from, seed)
  const db = new StudyDb(name)
  await db.open()
  return db
}

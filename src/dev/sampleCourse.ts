import { db } from '../db/db'
import { importCourse, parseBundle } from '../db/importCourse'

/** Dev builds only: imports the made-up sample course from dev/sample-course.json. */
export async function loadSampleCourse() {
  const { default: json } = await import('../../dev/sample-course.json?raw')
  return importCourse(db, parseBundle(json))
}

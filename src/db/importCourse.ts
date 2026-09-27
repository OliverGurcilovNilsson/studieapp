import { BUNDLE_FORMAT, BUNDLE_VERSION, type ContentBundle } from '../content/schema'
import type { StudyDb } from './db'

export interface ImportResult {
  courseId: string
  questions: number
  added: number
  /** Questions she has progress on that the new bundle no longer contains (progress is kept). */
  orphanedProgress: number
}

export class ImportError extends Error {}

/** Throws ImportError with a Swedish message when the file is not a course bundle this app understands. */
export function parseBundle(json: string): ContentBundle {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new ImportError('Filen är inte giltig JSON.')
  }
  const b = data as Partial<ContentBundle>
  if (b?.format !== BUNDLE_FORMAT) throw new ImportError('Filen är inte en kursfil för Studieappen.')
  if (b.version !== BUNDLE_VERSION)
    throw new ImportError(`Kursfilen har version ${b.version}, appen förstår version ${BUNDLE_VERSION}.`)
  if (!b.course?.id || !Array.isArray(b.questions)) throw new ImportError('Kursfilen saknar kurs eller frågor.')
  return b as ContentBundle
}

function base64ToBlob(data: string, mime: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

/**
 * Replaces the course's CONTENT with the bundle's, in one transaction.
 * Progress (reviewStates, reviewLog) is keyed by question id and is never touched,
 * so re-importing a corrected bundle keeps everything she has learned.
 */
export async function importCourse(db: StudyDb, bundle: ContentBundle): Promise<ImportResult> {
  const courseId = bundle.course.id
  const withCourse = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, courseId }))
  const contentTables = [
    db.sources,
    db.lectures,
    db.objectives,
    db.exams,
    db.questions,
    db.templates,
    db.articles,
    db.assets,
  ]

  return db.transaction('rw', [db.courses, db.reviewStates, ...contentTables], async () => {
    const before = new Set((await db.questions.where({ courseId }).primaryKeys()).map(([, id]) => id))
    await Promise.all(contentTables.map((t) => t.where({ courseId }).delete()))

    await db.courses.put(bundle.course)
    await db.sources.bulkPut(withCourse(bundle.sources))
    await db.lectures.bulkPut(withCourse(bundle.lectures))
    await db.objectives.bulkPut(withCourse(bundle.objectives))
    await db.exams.bulkPut(withCourse(bundle.exams))
    await db.questions.bulkPut(withCourse(bundle.questions))
    await db.templates.bulkPut(withCourse(bundle.reviewTemplates))
    await db.articles.bulkPut(withCourse(bundle.articles))
    await db.assets.bulkPut(
      bundle.assets
        .filter((a) => a.data)
        .map((a) => ({ courseId, id: a.id, mime: a.mime, caption: a.caption, blob: base64ToBlob(a.data!, a.mime) })),
    )

    const ids = new Set(bundle.questions.map((q) => q.id))
    const progressIds = (await db.reviewStates.where({ courseId }).primaryKeys()).map(([, id]) => id)
    return {
      courseId,
      questions: ids.size,
      added: [...ids].filter((id) => !before.has(id)).length,
      orphanedProgress: progressIds.filter((id) => !ids.has(id)).length,
    }
  })
}

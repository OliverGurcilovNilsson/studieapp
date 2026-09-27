import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import json from '../../dev/sample-course.json?raw'
import { hasTrustedAnswer, type QuestionType } from '../content/schema'
import { StudyDb } from '../db/db'
import { importCourse, parseBundle } from '../db/importCourse'
import { isPractisable } from '../lib/session'

const bundle = parseBundle(json)

describe('dev sample course', () => {
  it('covers every question type', () => {
    const types = new Set(bundle.questions.map((q) => q.type))
    const all: QuestionType[] = ['mcq', 'mcq_multi', 'free_text', 'calculation', 'flashcard', 'article_review']
    expect([...types].sort()).toEqual([...all].sort())
  })

  it('covers every answer provenance, including a question without a trusted answer', () => {
    const answers = bundle.questions.flatMap((q) => q.answers)
    expect(answers.some((a) => a.provenance === 'official')).toBe(true)
    expect(answers.some((a) => a.provenance === 'student' && a.awarded === a.max)).toBe(true)
    expect(answers.some((a) => a.provenance === 'student' && a.awarded !== undefined && a.awarded < a.max!)).toBe(true)
    expect(answers.some((a) => a.provenance === 'student' && a.awarded === undefined)).toBe(true)
    expect(answers.some((a) => a.provenance === 'own_notes' && a.short)).toBe(true)
    expect(bundle.questions.some((q) => !hasTrustedAnswer(q))).toBe(true)
    expect(bundle.questions.some((q) => q.type === 'mcq_multi' && q.negativeMarking)).toBe(true)
    expect(bundle.questions.some((q) => q.numeric?.decimals !== undefined)).toBe(true)
  })

  it('has two exams and only internal references that resolve', () => {
    expect(bundle.exams).toHaveLength(2)
    const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((r) => r.id))
    const exams = ids(bundle.exams)
    const objectives = ids(bundle.objectives)
    const sources = ids(bundle.sources)
    const assets = ids(bundle.assets)
    const articles = ids(bundle.articles)
    const items = new Set(bundle.reviewTemplates.flatMap((t) => t.items.map((i) => i.id)))
    for (const q of bundle.questions) {
      if (q.examId) expect(exams).toContain(q.examId)
      q.objectiveIds.forEach((o) => expect(objectives).toContain(o))
      q.answers.forEach((a) => expect(sources).toContain(a.sourceId))
      q.assetIds?.forEach((a) => expect(assets).toContain(a))
      if (q.articleId) expect(articles).toContain(q.articleId)
      if (q.templateItemId) expect(items).toContain(q.templateItemId)
      expect(isPractisable(q)).toBe(true)
    }
    expect(bundle.assets.some((a) => a.mime === 'image/png')).toBe(true)
  })

  it('imports into the database', async () => {
    const db = new StudyDb(`sample-${crypto.randomUUID()}`)
    const result = await importCourse(db, bundle)
    expect(result.questions).toBe(bundle.questions.length)
    const png = await db.assets.get([bundle.course.id, 'fig-1'])
    const bytes = new Uint8Array(await png!.blob.arrayBuffer())
    expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG')
    await db.delete()
  })
})

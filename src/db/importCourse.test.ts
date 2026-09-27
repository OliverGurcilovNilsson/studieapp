import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BUNDLE_FORMAT, BUNDLE_VERSION, type ContentBundle, type Question } from '../content/schema'
import { newCard } from '../lib/scheduler'
import { StudyDb } from './db'
import { describeImport, ImportError, importCourse, parseBundle } from './importCourse'

// Made-up sample content only: real course material never enters the repo.
const question = (id: string, prompt = 'Vad är 1 + 1?'): Question => ({
  id,
  origin: 'exam',
  status: 'approved',
  topic: 'testamne',
  objectiveIds: [],
  type: 'free_text',
  prompt,
  answers: [{ provenance: 'official', text: '2', sourceId: 'src-1' }],
})

const bundle = (questions: Question[], courseId = 'test-course'): ContentBundle => ({
  format: BUNDLE_FORMAT,
  version: BUNDLE_VERSION,
  course: { id: courseId, code: 'TEST01', name: 'Testkurs', lang: 'sv' },
  sources: [{ id: 'src-1', file: 'exempel.pdf', kind: 'official_exam' }],
  lectures: [],
  objectives: [],
  exams: [],
  questions,
  reviewTemplates: [],
  articles: [],
  assets: [{ id: 'fig-1', mime: 'image/png', data: btoa('fake-png') }],
})

let db: StudyDb
beforeEach(() => {
  db = new StudyDb(`test-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('importCourse', () => {
  it('imports content and decodes assets to blobs', async () => {
    const result = await importCourse(db, bundle([question('q1'), question('q2')]))
    expect(result).toEqual({ courseId: 'test-course', questions: 2, added: 2, orphanedProgress: 0 })
    const asset = await db.assets.get(['test-course', 'fig-1'])
    expect(await asset!.blob.text()).toBe('fake-png')
  })

  it('keeps progress when the course is re-imported with corrections', async () => {
    await importCourse(db, bundle([question('q1'), question('q2')]))
    await db.reviewStates.put({
      courseId: 'test-course',
      questionId: 'q1',
      due: 0,
      card: newCard(0),
    })

    const result = await importCourse(db, bundle([question('q1', 'Rättad fråga'), question('q3')]))

    expect(await db.reviewStates.count()).toBe(1)
    expect((await db.questions.get(['test-course', 'q1']))!.prompt).toBe('Rättad fråga')
    expect(await db.questions.get(['test-course', 'q2'])).toBeUndefined()
    expect(result.added).toBe(1)
  })

  it('reports progress whose question disappeared, without deleting it', async () => {
    await importCourse(db, bundle([question('q1')]))
    await db.reviewStates.put({
      courseId: 'test-course',
      questionId: 'q1',
      due: 0,
      card: newCard(0),
    })
    const result = await importCourse(db, bundle([question('q9')]))
    expect(result.orphanedProgress).toBe(1)
    expect(await db.reviewStates.count()).toBe(1)
  })

  it('keeps courses apart even when question ids collide', async () => {
    await importCourse(db, bundle([question('q1')], 'kurs-a'))
    await importCourse(db, bundle([question('q1', 'Annan kurs')], 'kurs-b'))
    expect((await db.questions.get(['kurs-a', 'q1']))!.prompt).toBe('Vad är 1 + 1?')
    expect((await db.questions.get(['kurs-b', 'q1']))!.prompt).toBe('Annan kurs')
  })
})

describe('parseBundle', () => {
  it('rejects files that are not course bundles', () => {
    expect(() => parseBundle('nope')).toThrow(ImportError)
    expect(() => parseBundle('{"format":"other"}')).toThrow('inte en kursfil')
    expect(() => parseBundle(JSON.stringify({ ...bundle([]), version: 99 }))).toThrow('version 99')
  })
})

describe('describeImport', () => {
  it('mentions orphaned progress only when there is some', () => {
    expect(describeImport('Testkurs', { courseId: 'c', questions: 3, added: 1, orphanedProgress: 0 })).toBe(
      'Testkurs importerad: 3 frågor, varav 1 nya.',
    )
    expect(describeImport('Testkurs', { courseId: 'c', questions: 3, added: 0, orphanedProgress: 1 })).toContain(
      '1 fråga du har övat på finns inte längre',
    )
  })
})

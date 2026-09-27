import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type {
  Course,
  Exam,
  Lecture,
  Objective,
  PracticeArticle,
  Question,
  ReviewTemplate,
  Source,
} from '../content/schema'

// Content ids are only unique within one course (two courses can both have "2025-10-01-q3"),
// so every content row carries its courseId and is keyed by [courseId+id].
type InCourse<T> = T & { courseId: string }

export type StoredQuestion = InCourse<Question>
export type StoredAsset = { courseId: string; id: string; mime: string; blob: Blob; caption?: string }

/** Learning progress. Keyed by question id, never deleted by a course re-import. */
export interface ReviewState {
  courseId: string
  questionId: string
  due: number // epoch ms, duplicated from card.due for the index
  card: StoredCard
  /** An AI-generated card she has approved. */
  approved?: boolean
}

/** ts-fsrs Card with dates as epoch ms, so it survives IndexedDB and JSON export unchanged. */
export interface StoredCard {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: number
}

export interface ReviewLogEntry {
  id?: number
  courseId: string
  questionId: string
  ts: number
  rating: 1 | 2 | 3 | 4 // Igen, Svår, Bra, Lätt
  guessed?: boolean
  durationMs?: number
}

export interface Setting {
  key: string
  value: unknown
}

/**
 * The schema, one entry per Dexie version. To change it:
 *  1. append a new entry (never edit an old one) with only the tables that change,
 *  2. put any data conversion in `upgrade` (never clear reviewStates, reviewLog or settings),
 *  3. add a test for that version to MIGRATION_TESTS in migrations.test.ts (the suite fails otherwise).
 */
export interface SchemaVersion {
  version: number
  stores: Record<string, string | null>
  upgrade?: (tx: Transaction) => Promise<void> | void
}

export const SCHEMA: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      courses: 'id',
      sources: '[courseId+id], courseId',
      lectures: '[courseId+id], courseId',
      objectives: '[courseId+id], courseId, lectureId',
      exams: '[courseId+id], courseId',
      questions: '[courseId+id], courseId, [courseId+topic], [courseId+examId], *objectiveIds',
      templates: '[courseId+id], courseId',
      articles: '[courseId+id], courseId',
      assets: '[courseId+id], courseId',
      reviewStates: '[courseId+questionId], courseId, [courseId+due]',
      reviewLog: '++id, [courseId+questionId], courseId, ts',
      settings: 'key',
    },
  },
]

export const LATEST_VERSION = SCHEMA[SCHEMA.length - 1].version

/** Tables holding her learning, which no migration may drop or clear. */
export const PROGRESS_TABLES = ['reviewStates', 'reviewLog', 'settings'] as const

export class StudyDb extends Dexie {
  courses!: EntityTable<Course, 'id'>
  sources!: Dexie.Table<InCourse<Source>, [string, string]>
  lectures!: Dexie.Table<InCourse<Lecture>, [string, string]>
  objectives!: Dexie.Table<InCourse<Objective>, [string, string]>
  exams!: Dexie.Table<InCourse<Exam>, [string, string]>
  questions!: Dexie.Table<StoredQuestion, [string, string]>
  templates!: Dexie.Table<InCourse<ReviewTemplate>, [string, string]>
  articles!: Dexie.Table<InCourse<PracticeArticle>, [string, string]>
  assets!: Dexie.Table<StoredAsset, [string, string]>
  reviewStates!: Dexie.Table<ReviewState, [string, string]>
  reviewLog!: EntityTable<ReviewLogEntry, 'id'>
  settings!: EntityTable<Setting, 'key'>

  /** `upTo` opens the schema as it was at an older version; only the migration tests use it. */
  constructor(name = 'studieapp', { upTo }: { upTo?: number } = {}) {
    super(name)
    for (const v of SCHEMA) {
      if (upTo !== undefined && v.version > upTo) break
      const version = this.version(v.version).stores(v.stores)
      if (v.upgrade) version.upgrade(v.upgrade)
    }
  }
}

export const db = new StudyDb()

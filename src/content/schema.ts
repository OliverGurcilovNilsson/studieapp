// Format of an importable course bundle (the JSON file that lives OUTSIDE the repo).
// This file is the single source of truth for the extract-course skill and the importer.

export const BUNDLE_FORMAT = 'studieapp-course'
export const BUNDLE_VERSION = 1

/**
 * Who wrote an answer. Only `official`, or `student` with awarded === max, counts as trusted.
 * `generated`: AI-written from lecture slides (cites `evidence`); trusted only once she approves the card.
 */
export type Provenance = 'official' | 'student' | 'own_notes' | 'generated'

export type QuestionType =
  | 'mcq' // exactly one correct option
  | 'mcq_multi' // one or more correct; may use negative marking
  | 'free_text'
  | 'calculation'
  | 'flashcard' // definitions only
  | 'article_review' // one checklist item applied to one article

export type SourceKind =
  | 'official_exam'
  | 'grading_guide'
  | 'student_copy'
  | 'own_notes'
  | 'lecture'
  | 'course_quiz'
  | 'study_questions'
  | 'article'
  | 'seminar_questions'

export interface ContentBundle {
  format: typeof BUNDLE_FORMAT
  version: typeof BUNDLE_VERSION
  course: Course
  sources: Source[]
  lectures: Lecture[]
  objectives: Objective[]
  exams: Exam[]
  questions: Question[]
  reviewTemplates: ReviewTemplate[]
  articles: PracticeArticle[]
  assets: Asset[]
}

export interface Course {
  id: string
  code: string
  name: string
  lang: string
  examInfo?: {
    maxPoints: number
    passPoints: number
    distinctionPoints?: number
    /** General grading rules, e.g. "Felaktiga avrundningar ger avdrag". */
    rules: string[]
  }
}

export interface Source {
  id: string
  /** File name only, never a path. */
  file: string
  kind: SourceKind
  examId?: string
  notes?: string
}

export interface Lecture {
  id: string
  title: string
  sourceId: string
  topic: string
}

export interface Objective {
  id: string
  lectureId?: string
  topic: string
  text: string
}

export interface Exam {
  id: string // e.g. "2025-10-01"
  date: string // ISO date, or "YYYY" when only the year is known
  kind: 'ordinarie' | 'omtenta' | 'unknown'
  sourceIds: string[]
}

export interface Evidence {
  sourceId: string
  pages: number[] // 1-based
  quote?: string
}

export interface Answer {
  provenance: Provenance
  text: string
  /** Condensed version shown first (e.g. "Kort svar till workshopen"). */
  short?: string
  awarded?: number // student answers only; absent = unknown score
  max?: number
  graderComment?: string
  sourceId: string
  pages?: number[]
}

export interface Question {
  id: string
  origin: 'exam' | 'workshop' | 'seminar' | 'quiz' | 'study_questions' | 'generated'
  status: 'approved' | 'unverified'
  examId?: string
  number?: string // "3b"
  part?: 'concepts' | 'article'
  topic: string
  objectiveIds: string[]
  type: QuestionType
  /** Shared case text for multi-part questions. */
  context?: string
  prompt: string
  assetIds?: string[]
  points?: number
  options?: { id: string; text: string }[]
  correct?: string[] // option ids
  negativeMarking?: boolean
  numeric?: {
    value: number
    unit?: string
    decimals?: number // required rounding; wrong rounding counts as wrong
    tolerance?: number
    solution?: string[] // worked steps
  }
  keyPoints?: string[]
  commonMistakes?: string[]
  /** Clarification added during extraction (not from any source). Shown labelled "Förklaring – ej facit". */
  explanation?: string
  articleId?: string
  templateItemId?: string
  answers: Answer[]
  evidence?: Evidence[]
}

export interface ReviewTemplate {
  id: string
  name: string
  sourceId: string
  items: { id: string; number: number; section: string; text: string }[]
}

export interface PracticeArticle {
  id: string
  title: string
  citation: string
  design: string
  assetId?: string // the article PDF
  templateId: string
  sourceIds: string[]
}

export interface Asset {
  id: string
  mime: string
  /** Base64 in the final bundle; a path relative to the content folder while extracting. */
  data?: string
  path?: string
  caption?: string
}

/** True when the question has an answer that may be treated as correct. */
export function hasTrustedAnswer(q: Pick<Question, 'answers'>): boolean {
  return q.answers.some(
    (a) =>
      a.provenance === 'official' ||
      (a.provenance === 'student' && a.awarded !== undefined && a.max !== undefined && a.awarded === a.max),
  )
}

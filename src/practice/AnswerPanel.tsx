import { useState } from 'react'
import { hasTrustedAnswer, type Answer, type Question } from '../content/schema'
import { setCardVerdict } from '../data/approval'
import type { ReviewState } from '../db/db'
import { isGenerated } from '../lib/trust'
import { IconAlert, IconSeal } from '../ui/icons'
import { RichText } from './RichText'

function sortAnswers(answers: Answer[]): Answer[] {
  const rank = (a: Answer) =>
    a.provenance === 'official' ? 0 : a.provenance === 'student' ? 1 + (1 - (a.awarded ?? -1) / (a.max || 1)) : 3
  return [...answers].sort((a, b) => rank(a) - rank(b))
}

function StudentAnswer({ a }: { a: Answer }) {
  const scored = a.awarded !== undefined && a.max !== undefined
  const full = scored && a.awarded === a.max
  return (
    <article className={`answer ${full ? 'answer-full' : scored ? 'answer-partial' : 'answer-unknown'}`}>
      <header>
        {scored ? (
          <span className={full ? 'badge' : 'badge badge-outline'}>
            {fmt(a.awarded!)}/{fmt(a.max!)} p
          </span>
        ) : (
          <span className="badge badge-dashed">Poäng okänd</span>
        )}
        <span className="answer-label">
          {full ? 'Fullpoäng · räknas som korrekt' : scored ? 'Delpoäng · inte facit' : 'Studentsvar'}
        </span>
      </header>
      <RichText text={a.text} />
      {a.graderComment && (
        <p className="grader">
          <b>Rättarens kommentar:</b> {a.graderComment}
        </p>
      )}
    </article>
  )
}

function OwnNotes({ a }: { a: Answer }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="answer answer-notes">
      <header>
        <span className="badge badge-soft">Egna anteckningar</span>
      </header>
      <RichText text={a.short ?? a.text} />
      {a.short && a.text !== a.short && (
        <>
          <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Dölj utförlig förklaring' : 'Utförlig förklaring'}
          </button>
          {open && <RichText text={a.text} className="long" />}
        </>
      )}
    </article>
  )
}

function GeneratedAnswer({
  question,
  answers,
  courseId,
  state,
}: {
  question: Question
  answers: Answer[]
  courseId: string
  state?: ReviewState
}) {
  const [verdict, setVerdict] = useState<'approved' | 'rejected' | undefined>(
    state?.approved ? 'approved' : undefined,
  )
  const pages = [...new Set(question.evidence?.flatMap((e) => e.pages) ?? answers.flatMap((a) => a.pages ?? []))]
  const decide = async (v: 'approved' | 'rejected') => {
    await setCardVerdict(courseId, question.id, v)
    setVerdict(v)
  }

  return (
    <article className="answer answer-generated">
      <header>
        <span className="badge badge-soft">Från föreläsningen · AI-sammanställt</span>
        {pages.length > 0 && (
          <span className="muted small">
            {pages.length === 1 ? 'Bild' : 'Bilder'} {pages.join(', ')}
          </span>
        )}
      </header>
      {answers.map((a, i) => (
        <RichText key={i} text={a.text} />
      ))}
      {verdict === 'approved' ? (
        <p className="small">
          <strong>Godkänt.</strong> Kortet räknas nu in i behärskat och prognosen.
        </p>
      ) : verdict === 'rejected' ? (
        <p className="small">
          <strong>Rapporterat som fel.</strong> Kortet visas inte igen.
        </p>
      ) : (
        <>
          <p className="small muted">
            Stämmer svaret med föreläsningen? Godkänn kortet så räknas det in, eller rapportera fel så försvinner det.
          </p>
          <div className="row-gap">
            <button type="button" className="btn btn-dark" onClick={() => decide('approved')}>
              Godkänn kortet
            </button>
            <button type="button" className="btn btn-outline" onClick={() => decide('rejected')}>
              Rapportera fel
            </button>
          </div>
        </>
      )}
    </article>
  )
}

const fmt = (n: number) => n.toLocaleString('sv-SE')

export function AnswerPanel({
  question,
  courseId,
  state,
}: {
  question: Question
  courseId?: string
  state?: ReviewState
}) {
  const answers = sortAnswers(question.answers)
  const official = answers.filter((a) => a.provenance === 'official')
  const students = answers.filter((a) => a.provenance === 'student')
  const notes = answers.filter((a) => a.provenance === 'own_notes')
  const generated = answers.filter((a) => a.provenance === 'generated')
  const trusted = hasTrustedAnswer(question)

  return (
    <div className="answer-panel">
      {isGenerated(question) && courseId && (
        <GeneratedAnswer question={question} answers={generated} courseId={courseId} state={state} />
      )}

      {!trusted && !isGenerated(question) && (
        <div className="notice">
          <IconAlert />
          <div>
            <strong>Osäkert facit</strong>
            <p>
              {notes.length && !students.length
                ? 'Det finns bara egna anteckningar till den här frågan. Bra som stöd, men kontrollera mot föreläsningarna.'
                : 'Det finns inget officiellt facit och inget svar med full poäng. Se svaren som ledtrådar, inte som sanning.'}
            </p>
          </div>
        </div>
      )}

      {official.map((a, i) => (
        <article key={`o${i}`} className="answer answer-official">
          <header>
            <IconSeal />
            <h3>Officiellt facit</h3>
          </header>
          <RichText text={a.text} />
        </article>
      ))}

      {!!question.keyPoints?.length && (
        <KeyPoints title="Nyckelpunkter – bocka av det du fick med" items={question.keyPoints} />
      )}
      {!!question.commonMistakes?.length && (
        <div className="mistakes">
          <h4>Vanliga misstag (ger avdrag)</h4>
          <ul>
            {question.commonMistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {students.length > 0 && (
        <>
          <div className="row-between">
            <h3 className="sub">Studentsvar</h3>
            <span className="muted small">visar hur poäng delas ut</span>
          </div>
          {students.map((a, i) => (
            <StudentAnswer key={`s${i}`} a={a} />
          ))}
        </>
      )}

      {notes.map((a, i) => (
        <OwnNotes key={`n${i}`} a={a} />
      ))}

      {question.explanation && (
        <details className="explanation">
          <summary>Förklaring – ej facit</summary>
          <RichText text={question.explanation} />
        </details>
      )}
    </div>
  )
}

function KeyPoints({ title, items }: { title: string; items: string[] }) {
  return (
    <fieldset className="keypoints">
      <legend>{title}</legend>
      {items.map((k, i) => (
        <label key={i}>
          <input type="checkbox" />
          <span>{k}</span>
        </label>
      ))}
    </fieldset>
  )
}

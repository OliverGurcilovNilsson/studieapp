import { useEffect, useRef, useState } from 'react'
import type { Grade } from 'ts-fsrs'
import type { PracticeArticle } from '../content/schema'
import {
  gradeFor,
  isSelfGraded,
  multiOutcome,
  numericOutcome,
  questionLabel,
  type Outcome,
} from '../lib/practice'
import { newCard, previewIntervals } from '../lib/scheduler'
import { checkNumeric, formatSwedish, scoreMulti, type NumericVerdict } from '../lib/scoring'
import type { QueueItem } from '../lib/session'
import { topicName } from '../lib/topics'
import { IconArrow, IconCheck, IconX } from '../ui/icons'
import { AnswerPanel } from './AnswerPanel'
import { ArticleBox, type TemplateItem } from './ArticleBox'
import { Figure } from './Figure'
import { RatingBar } from './RatingBar'
import { RichText } from './RichText'

export interface RunnerResult {
  grade: Grade
  guessed?: boolean
  outcome?: Outcome
  durationMs: number
}

interface Props {
  courseId: string
  item: QueueItem
  examDate?: number
  article?: { article: PracticeArticle; item?: TemplateItem }
  onDone: (r: RunnerResult) => void
}

const LETTERS = 'ABCDEFGH'

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox')
}

/** One question: answer it, see the key, rate it. Keyed by the parent, so state resets per question. */
export function QuestionRunner({ courseId, item, examDate, article, onDone }: Props) {
  const q = item.question
  const selfGraded = isSelfGraded(q)
  const options = q.options ?? []
  const correct = q.correct ?? []
  const points = q.points ?? correct.length

  const [choice, setChoice] = useState<string>() // mcq
  const [guessed, setGuessed] = useState(false)
  const [selected, setSelected] = useState<string[]>([]) // mcq_multi
  const [multiChecked, setMultiChecked] = useState(false)
  const [input, setInput] = useState('') // calculation
  const [verdict, setVerdict] = useState<NumericVerdict>()
  const [draft, setDraft] = useState('') // self-graded types
  const [revealed, setRevealed] = useState(false)

  const [started] = useState(() => Date.now())
  const done = useRef(false)
  const nextBtn = useRef<HTMLButtonElement>(null)

  const multiScore = multiChecked ? scoreMulti(selected, correct, points, q.negativeMarking) : undefined
  const outcome: Outcome | undefined =
    q.type === 'mcq'
      ? choice === undefined ? undefined : correct.includes(choice) ? 'correct' : 'wrong'
      : q.type === 'mcq_multi'
        ? multiScore !== undefined ? multiOutcome(multiScore, points) : undefined
        : !selfGraded && verdict
          ? numericOutcome(verdict)
          : undefined
  const answered = selfGraded ? revealed : outcome !== undefined
  const [intervals] = useState(() => {
    const now = Date.now()
    return previewIntervals(item.state?.card ?? newCard(now), now, examDate)
  })

  function finish(grade: Grade) {
    if (done.current) return
    done.current = true
    onDone({
      grade,
      guessed: q.type === 'mcq' && outcome === 'correct' && guessed ? true : undefined,
      outcome,
      durationMs: Date.now() - started,
    })
  }
  const next = () => outcome && finish(gradeFor(outcome))
  const rate = (g: Grade) => answered && finish(g)
  const reveal = () => {
    setRevealed(true)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }
  function checkCalc() {
    if (!q.numeric) return
    if (verdict && verdict.kind !== 'unparseable') return next()
    setVerdict(checkNumeric(input, q.numeric))
  }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // Put focus on "Nästa fråga" once an auto-scored answer is in, so Enter continues.
  useEffect(() => {
    if (!selfGraded && answered) nextBtn.current?.focus()
  }, [selfGraded, answered])

  // Desktop shortcuts: 1–4 rate, A–D choose, Space reveal, Enter next, Cmd/Ctrl+Enter reveal from the textarea.
  function onKey(e: KeyboardEvent) {
    if (isTyping(e.target)) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && selfGraded && !revealed) {
        e.preventDefault()
        reveal()
      }
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    // Let a focused button or link handle its own Enter/Space.
    const onControl = e.target instanceof HTMLElement && /^(BUTTON|A|SUMMARY)$/.test(e.target.tagName)
    if ((e.key === 'Enter' || e.key === ' ') && onControl) return

    if (/^[1-4]$/.test(e.key) && answered) {
      e.preventDefault()
      return rate(Number(e.key) as Grade)
    }
    const idx = LETTERS.indexOf(e.key.toUpperCase())
    if (e.key.length === 1 && idx >= 0 && idx < options.length) {
      if (q.type === 'mcq' && !choice) setChoice(options[idx].id)
      if (q.type === 'mcq_multi' && !multiChecked) toggle(options[idx].id)
      return
    }
    if (e.key === ' ' && selfGraded && !revealed) {
      e.preventDefault()
      return reveal()
    }
    if (e.key === 'Enter') {
      // preventDefault: otherwise the same keystroke would also click the newly focused "Nästa fråga".
      e.preventDefault()
      if (q.type === 'mcq_multi' && !multiChecked && selected.length) return setMultiChecked(true)
      if (!selfGraded && answered) return next()
    }
  }
  const handler = useRef(onKey)
  useEffect(() => {
    handler.current = onKey
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handler.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const twoCol = selfGraded
  const optionClass = (id: string) => {
    if (q.type === 'mcq') {
      if (!choice) return ''
      if (correct.includes(id)) return 'is-correct'
      return id === choice ? 'is-wrong' : 'is-dim'
    }
    if (!multiChecked) return selected.includes(id) ? 'is-selected' : ''
    const picked = selected.includes(id)
    if (correct.includes(id)) return picked ? 'is-correct' : 'is-missed'
    return picked ? 'is-wrong' : 'is-dim'
  }

  return (
    <div className="runner">
      <div className={`runner-body ${twoCol ? 'two-col' : ''}`}>
        <div className="runner-q">
          <div className="q-label">{questionLabel(q, topicName)}</div>
          {article && <ArticleBox courseId={courseId} article={article.article} item={article.item} />}
          <div className="q-card">
            {q.context && <RichText className="q-context" text={q.context} />}
            <div className="q-eyebrow">{q.type === 'flashcard' ? 'begrepp' : 'fråga'}</div>
            <RichText className="q-prompt" text={q.prompt} />
          </div>
          {q.assetIds?.map((id) => <Figure key={id} courseId={courseId} assetId={id} />)}
        </div>

        <div className="runner-a">
          {(q.type === 'mcq' || q.type === 'mcq_multi') && (
            <>
              {q.type === 'mcq_multi' && (
                <p className="muted small">
                  Välj alla som stämmer.{q.negativeMarking ? ' Fel val ger avdrag.' : ''}
                </p>
              )}
              <div className="options" role={q.type === 'mcq' ? 'radiogroup' : 'group'} aria-label="Svarsalternativ">
                {options.map((o, i) => {
                  const cls = optionClass(o.id)
                  const locked = q.type === 'mcq' ? !!choice : multiChecked
                  return (
                    <button
                      key={o.id}
                      className={`option ${cls}`}
                      role={q.type === 'mcq' ? 'radio' : 'checkbox'}
                      aria-checked={q.type === 'mcq' ? choice === o.id : selected.includes(o.id)}
                      disabled={locked}
                      onClick={() => (q.type === 'mcq' ? setChoice(o.id) : toggle(o.id))}
                    >
                      <span className="option-key">{LETTERS[i]}</span>
                      <span className="option-text">{o.text}</span>
                      {cls === 'is-correct' && <IconCheck width={20} height={20} />}
                      {cls === 'is-wrong' && <IconX width={20} height={20} />}
                      {cls === 'is-missed' && <span className="small nowrap">missad</span>}
                    </button>
                  )
                })}
              </div>
              {multiScore !== undefined && (
                <p className={`pill ${outcome === 'correct' ? 'pill-ok' : outcome === 'partial' ? 'pill-warn' : 'pill-bad'}`}>
                  {formatSwedish(Math.round(multiScore * 100) / 100)} av {formatSwedish(points)} p
                </p>
              )}
              {q.type === 'mcq' && outcome === 'correct' && (
                <div className="confidence">
                  <div className="confidence-title">Hur säker var du?</div>
                  <div className="segmented" role="group" aria-label="Säkerhet">
                    <button aria-pressed={!guessed} onClick={() => setGuessed(false)}>
                      Säker
                    </button>
                    <button aria-pressed={guessed} onClick={() => setGuessed(true)}>
                      Gissade
                    </button>
                  </div>
                  <p className="muted small">Gissade rätt? Då kommer frågan tillbaka tidigare.</p>
                </div>
              )}
              {answered && q.answers.length > 0 && (
                <details className="more">
                  <summary>Visa facit och förklaring</summary>
                  <AnswerPanel question={q} />
                </details>
              )}
            </>
          )}

          {q.type === 'calculation' && q.numeric && (
            <>
              <form
                className="calc"
                onSubmit={(e) => {
                  e.preventDefault()
                  checkCalc()
                }}
              >
                <label htmlFor="calc-input" className="field-label">
                  Ditt svar
                </label>
                <div className="calc-row">
                  <input
                    id="calc-input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={input}
                    readOnly={answered}
                    onChange={(e) => {
                      setInput(e.target.value)
                      if (verdict?.kind === 'unparseable') setVerdict(undefined)
                    }}
                  />
                  {q.numeric.unit && <span className="calc-unit">{q.numeric.unit}</span>}
                </div>
                {!answered && (
                  <>
                    {q.numeric.decimals !== undefined && (
                      <p className="muted small">
                        Avrunda till {q.numeric.decimals} {q.numeric.decimals === 1 ? 'decimal' : 'decimaler'}.
                      </p>
                    )}
                    <button className="btn btn-dark" disabled={!input.trim()}>
                      Kontrollera
                    </button>
                  </>
                )}
                {verdict && <Verdict verdict={verdict} tolerance={q.numeric.tolerance} unit={q.numeric.unit} />}
              </form>
              {answered && !!q.numeric.solution?.length && (
                <div className="solution">
                  <h3>Lösningsgång</h3>
                  <ol>
                    {q.numeric.solution.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {answered && q.answers.length > 0 && (
                <details className="more">
                  <summary>Visa facit och studentsvar</summary>
                  <AnswerPanel question={q} />
                </details>
              )}
            </>
          )}

          {selfGraded && !revealed && (
            <>
              <label htmlFor="draft" className="field-label">
                Ditt svar
              </label>
              <textarea
                id="draft"
                className="draft"
                rows={q.type === 'flashcard' ? 3 : 7}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={q.type === 'flashcard' ? 'Förklara begreppet med egna ord…' : 'Skriv ditt svar här…'}
              />
              <p className="muted small hint-desktop">Ctrl/Cmd+Enter visar facit.</p>
            </>
          )}
          {selfGraded && revealed && (
            <>
              {draft.trim() && (
                <div className="my-answer">
                  <div className="eyebrow">Ditt svar</div>
                  <RichText text={draft} />
                </div>
              )}
              <AnswerPanel question={q} />
            </>
          )}
        </div>
      </div>

      <div className={`runner-actions ${twoCol ? 'two-col' : ''}`}>
        {selfGraded && !revealed && (
          <button className="btn btn-primary btn-block" onClick={reveal}>
            Visa facit <kbd className="kbd">Mellanslag</kbd>
          </button>
        )}
        {selfGraded && revealed && <RatingBar intervals={intervals} onRate={rate} />}
        {q.type === 'mcq_multi' && !multiChecked && (
          <button className="btn btn-dark btn-block" disabled={!selected.length} onClick={() => setMultiChecked(true)}>
            Kontrollera
          </button>
        )}
        {!selfGraded && answered && (
          <button ref={nextBtn} className="btn btn-primary btn-block" onClick={next}>
            Nästa fråga <IconArrow width={20} height={20} />
          </button>
        )}
      </div>
    </div>
  )
}

function Verdict({ verdict, tolerance, unit }: { verdict: NumericVerdict; tolerance?: number; unit?: string }) {
  const u = unit ? ` ${unit}` : ''
  switch (verdict.kind) {
    case 'correct':
      return (
        <p className="pill pill-ok" role="status">
          <IconCheck width={16} height={16} /> Rätt{tolerance ? ` · inom ±${formatSwedish(tolerance)}` : ''}
        </p>
      )
    case 'wrong_rounding':
      return (
        <div role="status">
          <p className="pill pill-warn">Fel avrundning</p>
          <p className="small">
            Rätt värde, men avrundat fel. Svaret ska vara <b>{verdict.expected}{u}</b>. På tentan ger det avdrag.
          </p>
        </div>
      )
    case 'wrong':
      return (
        <div role="status">
          <p className="pill pill-bad">
            <IconX width={16} height={16} /> Fel
          </p>
          <p className="small">
            Rätt svar: <b>{verdict.expected}{u}</b>
          </p>
        </div>
      )
    case 'unparseable':
      return (
        <p className="small error" role="status">
          Skriv ett tal, till exempel 12,5.
        </p>
      )
  }
}

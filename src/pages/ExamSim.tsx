import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { PracticeArticle, Question, ReviewTemplate } from '../content/schema'
import { getSetting, loadCourseData, setSetting, type CourseData } from '../data/queries'
import { SETTINGS } from '../data/settings'
import { db } from '../db/db'
import {
  autoScore,
  EXAM_DURATION_MS,
  formatClock,
  isAnswered,
  maxPoints,
  paperOrder,
  pause,
  questionHeading,
  remaining,
  resume,
  scoreExam,
  weakest,
  type ScoreLine,
  type SimAnswer,
  type SimClock,
} from '../lib/examSim'
import { isSelfGraded } from '../lib/practice'
import { AnswerPanel } from '../practice/AnswerPanel'
import { RichText } from '../practice/RichText'
import { SimQuestion } from '../sim/SimQuestion'
import { IconArrow, IconBack, IconClose, MascotHappy } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

interface SimState {
  examId: string
  phase: 'running' | 'grading' | 'result'
  answers: Record<string, SimAnswer>
  selfScores: Record<string, number>
  clock: SimClock
  pos: number
}

interface Loaded {
  cd: CourseData
  saved?: SimState
  articles: PracticeArticle[]
  templates: ReviewTemplate[]
}

const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })

export function ExamSim() {
  const { courseId = '' } = useParams()
  const { data, loading } = useAsync(async (): Promise<Loaded | undefined> => {
    const cd = await loadCourseData(courseId)
    if (!cd) return undefined
    const [saved, articles, templates] = await Promise.all([
      getSetting<SimState | undefined>(SETTINGS.examSim(courseId), undefined),
      db.articles.where({ courseId }).toArray(),
      db.templates.where({ courseId }).toArray(),
    ])
    return { cd, saved, articles, templates }
  }, [courseId])

  if (loading) return null
  if (!data) return <p>Kursen finns inte.</p>
  return <Sim data={data} />
}

function Sim({ data }: { data: Loaded }) {
  const courseId = data.cd.course.id
  const back = `/kurs/${courseId}`
  const [state, setState] = useState<SimState | undefined>(data.saved)
  const [now, setNow] = useState(() => Date.now())
  const key = SETTINGS.examSim(courseId)

  // Persist every change (debounced), so a reload or a closed tab never loses her answers.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => setSetting(key, state), 300)
    return () => clearTimeout(t)
  }, [key, state])

  // Leaving the page saves the latest answers at once and pauses the clock.
  const latest = useRef(state)
  const closed = useRef(false)
  useEffect(() => {
    latest.current = state
  })
  useEffect(
    () => () => {
      const s = latest.current
      if (closed.current || !s) return
      setSetting(key, s.phase === 'running' ? { ...s, clock: pause(s.clock, Date.now()) } : s)
    },
    [key],
  )

  const running = state?.phase === 'running' && state.clock.runningSince !== undefined
  // Tick once a second; when time is up, hand in automatically.
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      setState((s) =>
        s?.phase === 'running' && remaining(s.clock, n) <= 0 ? { ...s, phase: 'grading', clock: pause(s.clock, n), pos: 0 } : s,
      )
    }, 1000)
    return () => clearInterval(t)
  }, [running])

  const questions = useMemo(() => (state ? paperOrder(data.cd.questions, state.examId) : []), [data.cd.questions, state])
  const left = state ? remaining(state.clock, now) : EXAM_DURATION_MS

  if (!state) {
    return (
      <Picker
        data={data}
        back={back}
        onStart={(examId) => {
          const t = Date.now()
          setNow(t)
          setState({ examId, phase: 'running', answers: {}, selfScores: {}, clock: resume({ elapsedMs: 0 }, t), pos: 0 })
        }}
      />
    )
  }

  const update = (patch: Partial<SimState>) => setState((s) => s && { ...s, ...patch })
  const close = () => {
    closed.current = true
    setSetting(key, undefined)
    setState(undefined)
  }

  if (state.phase === 'running')
    return (
      <Runner
        data={data}
        state={state}
        questions={questions}
        left={left}
        back={back}
        onAnswer={(id, a) => update({ answers: { ...state.answers, [id]: a } })}
        onMove={(pos) => update({ pos })}
        onPause={() => {
          const t = Date.now()
          setNow(t)
          update({ clock: state.clock.runningSince !== undefined ? pause(state.clock, t) : resume(state.clock, t) })
        }}
        onHandIn={() => update({ phase: 'grading', clock: pause(state.clock, Date.now()), pos: 0 })}
      />
    )

  if (state.phase === 'grading')
    return (
      <Grader
        state={state}
        questions={questions}
        back={back}
        onScore={(id, p) => update({ selfScores: { ...state.selfScores, [id]: p } })}
        onMove={(pos) => update({ pos })}
        onDone={() => update({ phase: 'result' })}
      />
    )

  return <Result data={data} state={state} questions={questions} onClose={close} back={back} />
}

function Picker({ data, back, onStart }: { data: Loaded; back: string; onStart: (examId: string) => void }) {
  const exams = [...new Set(data.cd.questions.map((q) => q.examId).filter(Boolean) as string[])].sort().reverse()
  return (
    <div className="practice sim-picker">
      <header className="practice-head">
        <Link to={back} className="icon-btn" aria-label="Tillbaka">
          <IconBack />
        </Link>
        <div className="practice-count">Tentasimulering</div>
        <span style={{ width: 44 }} />
      </header>
      <p className="muted">
        Välj en gammal tenta. Du har {EXAM_DURATION_MS / 3_600_000} timmar och kan pausa. Flerval och beräkningar rättas
        automatiskt, fritext rättar du själv mot facit efteråt.
      </p>
      <div className="sim-exams">
        {exams.map((id) => {
          const qs = paperOrder(data.cd.questions, id)
          const points = qs.reduce((a, q) => a + maxPoints(q), 0)
          return (
            <button key={id} className="tile sim-exam" onClick={() => onStart(id)} disabled={!qs.length}>
              <strong>Tenta {id}</strong>
              <span className="muted small">
                {qs.length} frågor · {fmt(points)} p
              </span>
              <span className="sim-start">
                Starta <IconArrow width={16} height={16} />
              </span>
            </button>
          )
        })}
        {!exams.length && <p>Kursen har inga gamla tentor än.</p>}
      </div>
    </div>
  )
}

function Runner({
  data,
  state,
  questions,
  left,
  back,
  onAnswer,
  onMove,
  onPause,
  onHandIn,
}: {
  data: Loaded
  state: SimState
  questions: Question[]
  left: number
  back: string
  onAnswer: (id: string, a: SimAnswer) => void
  onMove: (pos: number) => void
  onPause: () => void
  onHandIn: () => void
}) {
  const paused = state.clock.runningSince === undefined
  const pos = Math.min(state.pos, questions.length - 1)
  const q = questions[pos]
  const articles = new Map(data.articles.map((a) => [a.id, a]))
  const items = new Map(data.templates.flatMap((t) => t.items.map((i) => [i.id, i] as const)))
  const article = q?.articleId ? articles.get(q.articleId) : undefined
  const answered = questions.filter((x) => isAnswered(state.answers[x.id])).length
  const handIn = () => {
    const open = questions.length - answered
    if (window.confirm(open ? `${open} frågor är obesvarade. Lämna in ändå?` : 'Lämna in tentan?')) onHandIn()
  }

  if (!q) return null
  return (
    <div className="practice sim">
      <header className="practice-head">
        <Link to={back} className="icon-btn" aria-label="Lämna simuleringen (pausas)">
          <IconClose />
        </Link>
        <button className={`sim-timer ${left < 15 * 60_000 ? 'is-low' : ''}`} onClick={onPause} aria-label={paused ? 'Fortsätt' : 'Pausa'}>
          <span>{formatClock(left)}</span>
          <span className="small">{paused ? '▶ Fortsätt' : '❚❚ Pausa'}</span>
        </button>
        <span className="practice-count">
          {pos + 1} / {questions.length}
        </span>
      </header>
      <nav className="sim-nav" aria-label="Frågor">
        {questions.map((x, i) => (
          <button
            key={x.id}
            className={`sim-chip ${i === pos ? 'is-current' : ''} ${isAnswered(state.answers[x.id]) ? 'is-done' : ''}`}
            onClick={() => onMove(i)}
            aria-current={i === pos}
          >
            {x.number ?? i + 1}
          </button>
        ))}
      </nav>

      {paused ? (
        <section className="empty sim-paused">
          <h1>Pausad</h1>
          <p>Klockan står still. Frågan visas när du fortsätter.</p>
          <button className="btn btn-primary" onClick={onPause}>
            Fortsätt
          </button>
        </section>
      ) : (
        <SimQuestion
          key={q.id}
          courseId={data.cd.course.id}
          question={q}
          answer={state.answers[q.id]}
          onChange={(a) => onAnswer(q.id, a)}
          article={article ? { article, item: q.templateItemId ? items.get(q.templateItemId) : undefined } : undefined}
        />
      )}

      <div className="runner-actions sim-actions">
        <div className="sim-buttons">
          <button className="btn" disabled={pos === 0} onClick={() => onMove(pos - 1)}>
            Föregående
          </button>
          {pos < questions.length - 1 ? (
            <button className="btn btn-dark" onClick={() => onMove(pos + 1)}>
              Nästa
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handIn}>
              Lämna in
            </button>
          )}
        </div>
        {pos < questions.length - 1 && (
          <button className="link-btn" onClick={handIn}>
            Lämna in nu ({answered}/{questions.length} besvarade)
          </button>
        )}
      </div>
    </div>
  )
}

function Grader({
  state,
  questions,
  back,
  onScore,
  onMove,
  onDone,
}: {
  state: SimState
  questions: Question[]
  back: string
  onScore: (id: string, p: number) => void
  onMove: (pos: number) => void
  onDone: () => void
}) {
  const toGrade = questions.filter(isSelfGraded)
  useEffect(() => {
    if (!toGrade.length) onDone()
  }, [toGrade.length, onDone])
  const pos = Math.min(state.pos, toGrade.length - 1)
  const q = toGrade[pos]
  if (!q) return null
  const max = maxPoints(q)
  const score = state.selfScores[q.id] ?? 0
  const text = state.answers[q.id]?.text?.trim()
  return (
    <div className="practice sim">
      <header className="practice-head">
        <Link to={back} className="icon-btn" aria-label="Lämna (sparas)">
          <IconClose />
        </Link>
        <div className="practice-count">
          Rätta själv · {pos + 1} / {toGrade.length}
        </div>
        <span style={{ width: 44 }} />
      </header>
      <div className="runner-body two-col">
        <div className="runner-q">
          <div className="q-label">{questionHeading(q)}</div>
          <div className="q-card">
            {q.context && <RichText className="q-context" text={q.context} />}
            <div className="q-eyebrow">fråga</div>
            <RichText className="q-prompt" text={q.prompt} />
          </div>
          <div className="my-answer">
            <div className="eyebrow">Ditt svar</div>
            {text ? <RichText text={text} /> : <p className="muted">Inget svar.</p>}
          </div>
        </div>
        <div className="runner-a">
          <AnswerPanel question={q} />
        </div>
      </div>
      <div className="runner-actions two-col">
        <div className="stepper" role="group" aria-label="Dina poäng">
          <button className="icon-btn" onClick={() => onScore(q.id, Math.max(0, score - 0.5))} aria-label="Minska">
            −
          </button>
          <output>
            {fmt(score)} / {fmt(max)} p
          </output>
          <button className="icon-btn" onClick={() => onScore(q.id, Math.min(max, score + 0.5))} aria-label="Öka">
            +
          </button>
        </div>
        <div className="sim-buttons">
          <button className="btn" disabled={pos === 0} onClick={() => onMove(pos - 1)}>
            Föregående
          </button>
          {pos < toGrade.length - 1 ? (
            <button className="btn btn-dark" onClick={() => onMove(pos + 1)}>
              Nästa
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onDone}>
              Visa resultat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Lines({ title, lines }: { title: string; lines: ScoreLine[] }) {
  return (
    <div className="score-lines">
      <h2 className="sub">{title}</h2>
      {lines.map((l) => (
        <div key={l.label}>
          <div className="row-between small-row">
            <span>{l.label}</span>
            <span>
              {fmt(l.points)} / {fmt(l.max)} p
            </span>
          </div>
          <div className="bar">
            <span style={{ width: `${l.max ? (l.points / l.max) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Result({
  data,
  state,
  questions,
  back,
  onClose,
}: {
  data: Loaded
  state: SimState
  questions: Question[]
  back: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const r = scoreExam(questions, state.answers, state.selfScores, data.cd.course.examInfo)
  const weak = weakest(r)
  const pct = r.max ? Math.round((r.total / r.max) * 100) : 0
  const finish = (to: string) => {
    onClose()
    navigate(to)
  }
  return (
    <div className="practice end sim-result">
      <header className="practice-head end-head">
        <button className="icon-btn" aria-label="Stäng" onClick={() => finish(back)}>
          <IconClose />
        </button>
      </header>
      <div className="end-kicker">tentasimulering klar · {state.examId}</div>
      <div className="end-top">
        <div className="big-number huge">
          {fmt(r.total)}/{fmt(r.max)}
        </div>
        <MascotHappy size={96} />
      </div>
      <div className="end-sub">
        poäng · {pct} % → <span className={`grade grade-${r.grade}`}>{r.grade}</span>
      </div>
      <p className="muted small">
        G från {fmt(r.passAt)} p{r.distinctionAt !== undefined ? `, VG från ${fmt(r.distinctionAt)} p` : ''}
        {data.cd.course.examInfo && r.max !== data.cd.course.examInfo.maxPoints
          ? ` (gränserna är omräknade från ${data.cd.course.examInfo.maxPoints} p till den här tentans ${fmt(r.max)} p)`
          : ''}
        .
      </p>

      <Lines title="Per del" lines={r.parts} />
      <Lines title="Per frågetyp" lines={r.types} />

      {weak.length > 0 && (
        <>
          <div className="muted small weak-title">Svagast just nu</div>
          <div className="weak">
            {weak.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </>
      )}

      <details className="more">
        <summary>Poäng per fråga</summary>
        <ul className="per-question">
          {questions.map((q) => {
            const p = autoScore(q, state.answers[q.id]) ?? state.selfScores[q.id] ?? 0
            return (
              <li key={q.id}>
                <span>{q.number ? `Fråga ${q.number}` : q.id}</span>
                <span>
                  {fmt(Math.min(p, maxPoints(q)))} / {fmt(maxPoints(q))} p
                </span>
              </li>
            )
          })}
        </ul>
      </details>

      <div className="end-actions">
        {r.missed.length > 0 && (
          <button
            className="btn btn-primary btn-block"
            onClick={() => finish(`/ova/${data.cd.course.id}?fragor=${r.missed.map(encodeURIComponent).join(',')}`)}
          >
            Repetera missarna
          </button>
        )}
        <button className="btn btn-block" onClick={() => finish(back)}>
          Till kursöversikten
        </button>
      </div>
    </div>
  )
}

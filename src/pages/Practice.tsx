import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { PracticeArticle, ReviewTemplate } from '../content/schema'
import { loadCourseData, loadCourses, loadPlanContext, type CourseData, type PlanContext } from '../data/queries'
import { saveReview } from '../data/review'
import { db, type ReviewState } from '../db/db'
import { dailyQueue } from '../lib/examMode'
import { buildAheadQueue, pickQuestions, summarize, type SessionResult } from '../lib/practice'
import { buildQueue, type QueueItem } from '../lib/session'
import { topicName } from '../lib/topics'
import { QuestionRunner, type RunnerResult } from '../practice/QuestionRunner'
import { IconClose, IconSkip, Mascot, MascotHappy } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

/** "Öva" in the nav: straight into the only course, or a choice when there are several. */
export function PracticeIndex() {
  const { data: courses, loading } = useAsync(loadCourses, [])
  if (loading) return null
  if (!courses?.length) return <Navigate to="/" replace />
  if (courses.length === 1) return <Navigate to={`/ova/${courses[0].id}`} replace />
  return (
    <section>
      <div className="page-head">
        <h1>Välj kurs</h1>
      </div>
      <div className="exam-list">
        {courses.map((c) => (
          <Link key={c.id} to={`/ova/${c.id}`} className="exam-chip">
            {c.code} · {c.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

interface Loaded {
  cd: CourseData
  ctx: PlanContext
  examDate?: number
  articles: PracticeArticle[]
  templates: ReviewTemplate[]
}

export function Practice() {
  const { courseId = '' } = useParams()
  const [params] = useSearchParams()
  const topic = params.get('amne') ?? undefined
  const examId = params.get('tenta') ?? undefined
  const ids = params.get('fragor') ?? undefined
  const { data, loading } = useAsync(async (): Promise<Loaded | undefined> => {
    const cd = await loadCourseData(courseId)
    if (!cd) return undefined
    const [ctx, articles, templates] = await Promise.all([
      loadPlanContext(courseId, Date.now()),
      db.articles.where({ courseId }).toArray(),
      db.templates.where({ courseId }).toArray(),
    ])
    return { cd, ctx, examDate: ctx.examDate, articles, templates }
  }, [courseId])

  if (loading) return null
  if (!data) return <Navigate to="/" replace />
  return <Session key={`${topic}|${examId}|${ids}`} data={data} topic={topic} examId={examId} ids={ids?.split(',')} />
}

function Session({ data, topic, examId, ids }: { data: Loaded; topic?: string; examId?: string; ids?: string[] }) {
  const courseId = data.cd.course.id
  const [states, setStates] = useState(data.cd.states)
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    ids
      ? pickQuestions(data.cd.questions, data.cd.states, ids)
      : examId
      ? buildQueue(data.cd.questions, data.cd.states, Date.now(), { examId, limit: 999, newLimit: 999 })
      : dailyQueue({ questions: data.cd.questions, states: data.cd.states, now: Date.now(), topic, ...data.ctx }),
  )
  const [pos, setPos] = useState(0)
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [error, setError] = useState<string>()

  const articles = useMemo(() => new Map(data.articles.map((a) => [a.id, a])), [data.articles])
  const templateItems = useMemo(
    () => new Map(data.templates.flatMap((t) => t.items.map((i) => [i.id, i] as const))),
    [data.templates],
  )
  const back = `/kurs/${courseId}`
  const scope = examId ? `Tenta ${examId}` : topic ? topicName(topic) : undefined

  if (!queue.length) {
    const ahead = buildAheadQueue(data.cd.questions, states, { topic, examId })
    return (
      <div className="practice">
        <PracticeHead back={back} />
        <section className="empty">
          <Mascot size={96} />
          <h1>Klart för idag!</h1>
          <p>Inget att repetera just nu{scope ? ` i ${scope}` : ''}. Kom tillbaka senare, eller öva i förväg.</p>
          {ahead.length > 0 && (
            <button className="btn btn-primary" onClick={() => setQueue(ahead)}>
              Öva ändå
            </button>
          )}
          <Link className="btn" to={back}>
            Till kursöversikten
          </Link>
        </section>
      </div>
    )
  }

  if (pos >= queue.length) {
    const summary = summarize(results)
    const byId = new Map(data.cd.questions.map((q) => [q.id, q]))
    const repeat = () => {
      setQueue(summary.missed.map((id) => ({ question: byId.get(id)!, state: states.get(id) })))
      setResults([])
      setPos(0)
      setRound((r) => r + 1)
    }
    return <EndScreen back={back} {...summary} onRepeat={repeat} />
  }

  const item = { ...queue[pos], state: states.get(queue[pos].question.id) }
  const q = item.question
  const article = q.articleId ? articles.get(q.articleId) : undefined

  async function onDone(r: RunnerResult) {
    try {
      const next: ReviewState = await saveReview(db, {
        courseId,
        questionId: q.id,
        state: item.state,
        grade: r.grade,
        guessed: r.guessed,
        now: Date.now(),
        examDate: data.examDate,
        durationMs: r.durationMs,
      })
      setStates((s) => new Map(s).set(q.id, next))
      setResults((rs) => [...rs, { questionId: q.id, grade: r.grade, outcome: r.outcome }])
      setPos((p) => p + 1)
    } catch (e) {
      setError(`Kunde inte spara: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const skip = () => setQueue((qs) => [...qs.slice(0, pos), ...qs.slice(pos + 1), qs[pos]])

  return (
    <div className="practice">
      <PracticeHead
        back={back}
        count={`${pos + 1} / ${queue.length}`}
        progress={pos / queue.length}
        onSkip={pos < queue.length - 1 ? skip : undefined}
      />
      {error && <p className="error">{error}</p>}
      <QuestionRunner
        key={`${round}:${pos}:${q.id}`}
        courseId={courseId}
        item={item}
        examDate={data.examDate}
        article={article ? { article, item: q.templateItemId ? templateItems.get(q.templateItemId) : undefined } : undefined}
        onDone={onDone}
      />
    </div>
  )
}

function PracticeHead({
  back,
  count,
  progress,
  onSkip,
}: {
  back: string
  count?: string
  progress?: number
  onSkip?: () => void
}) {
  return (
    <>
      <header className="practice-head">
        <Link to={back} className="icon-btn" aria-label="Avsluta passet">
          <IconClose />
        </Link>
        <div className="practice-count">{count}</div>
        {onSkip ? (
          <button className="icon-btn" aria-label="Hoppa över" title="Hoppa över" onClick={onSkip}>
            <IconSkip />
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
      </header>
      {progress !== undefined && (
        <div className="bar practice-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </>
  )
}

function EndScreen({
  back,
  total,
  right,
  missed,
  onRepeat,
}: {
  back: string
  total: number
  right: number
  missed: string[]
  onRepeat: () => void
}) {
  const pct = total ? Math.round((right / total) * 100) : 0
  return (
    <div className="practice end">
      <header className="practice-head end-head">
        <Link to={back} className="icon-btn" aria-label="Stäng">
          <IconClose />
        </Link>
      </header>
      <div className="end-kicker">passet klart</div>
      <div className="end-top">
        <div className="big-number huge">
          {right}/{total}
        </div>
        <MascotHappy size={96} />
      </div>
      <div className="end-sub">rätt · {pct} %</div>
      <div className="bubbles">
        <div className="bubble bubble-peri">
          <b>{right}</b>
          <span>rätt</span>
        </div>
        <div className="bubble bubble-blue">
          <b>{missed.length}</b>
          <span>att repetera</span>
        </div>
      </div>
      <div className="end-actions">
        {missed.length > 0 && (
          <button className="btn btn-primary btn-block" onClick={onRepeat} autoFocus>
            Repetera missarna
          </button>
        )}
        <Link className={`btn btn-block ${missed.length ? '' : 'btn-primary'}`} to={back}>
          Till kursöversikten
        </Link>
      </div>
    </div>
  )
}

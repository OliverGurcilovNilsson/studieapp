import { Link, useParams } from 'react-router-dom'
import { loadCourseData, loadPlanContext, predictedRecall, topicStats } from '../data/queries'
import { db } from '../db/db'
import { coverage } from '../lib/coverage'
import { dailyQueue, daysUntil, forecastScore, isExamModeActive } from '../lib/examMode'
import { mistakeBank } from '../lib/mistakes'
import { buildQueue } from '../lib/session'
import { topicColor, topicName } from '../lib/topics'
import { IconBack, IconBolt, Mascot, TileIconExam, TileIconMap, TileIconMistakes, TileIconPractice } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

export function Course() {
  const { courseId = '' } = useParams()
  const { data, loading } = useAsync(async () => {
    const cd = await loadCourseData(courseId)
    if (!cd) return undefined
    const now = Date.now()
    const ctx = await loadPlanContext(courseId, now)
    const { examDate } = ctx
    const stats = topicStats(cd, now)
    const total = stats.reduce((a, t) => a + t.total, 0)
    const mastered = stats.reduce((a, t) => a + t.mastered, 0)
    const examMode = isExamModeActive(examDate, now)
    // In exam mode "today" is the paced plan (due + today's new); otherwise the due reviews.
    const dueToday = examMode
      ? dailyQueue({ questions: cd.questions, states: cd.states, now, ...ctx }).length
      : buildQueue(cd.questions, cd.states, now, { limit: 999, newLimit: 0 }).length
    const exams = [...new Set(cd.questions.map((q) => q.examId).filter(Boolean) as string[])].sort().reverse()
    const forecast = examMode ? predictedRecall(cd, examDate) : undefined
    const points = examMode && cd.course.examInfo ? forecastScore(cd.questions, cd.states, examDate, cd.course.examInfo) : undefined
    const daysLeft = examMode ? daysUntil(examDate, now) : undefined
    const [log, objectives] = await Promise.all([
      db.reviewLog.where({ courseId }).toArray(),
      db.objectives.where({ courseId }).toArray(),
    ])
    const mistakes = mistakeBank(cd.questions, cd.states, log).length
    const gaps = coverage(cd.questions, cd.states, objectives).topics.filter((t) => t.total === 0 || t.notStarted > 0).length
    return { cd, stats, total, mastered, dueToday, exams, examDate, forecast, points, daysLeft, mistakes, gaps }
  }, [courseId])

  if (loading) return null
  if (!data) return <p>Kursen finns inte. <Link to="/">Till biblioteket</Link></p>
  const { cd, stats, total, mastered, dueToday, exams, examDate, forecast, points, daysLeft, mistakes, gaps } = data
  const pct = total ? Math.round((mastered / total) * 100) : 0

  return (
    <section className="course">
      <div className="page-head">
        <Link to="/" className="icon-btn" aria-label="Tillbaka">
          <IconBack />
        </Link>
        <span className="eyebrow">Kursöversikt</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="hero-card">
        <div>
          <div className="eyebrow on-accent">{cd.course.code}</div>
          <h1>{cd.course.name}</h1>
          <p>
            {total} frågor · {stats.length} ämnen · {exams.length} tentor
          </p>
        </div>
        <Mascot size={78} />
      </div>

      <div className="course-top">
        <div>
          <div className="row-between">
            <span className="muted">Behärskat</span>
            <strong>{pct}%</strong>
          </div>
          <div className="bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          {points && (
            <div className="forecast-points">
              <span className="eyebrow">Tentaläge · {daysLeft} {daysLeft === 1 ? 'dag' : 'dagar'} kvar</span>
              <span>
                Beräknad poäng{' '}
                <strong>
                  {points.points}/{points.max} → {points.grade}
                </strong>
              </span>
            </div>
          )}
          {forecast !== undefined && (
            <p className="forecast">
              Beräknad kunskap på tentadagen: <strong>{Math.round(forecast * 100)} %</strong>
              <span className="muted"> · uppskattning</span>
            </p>
          )}
          {!examDate && (
            <p className="forecast muted small">
              <Link to="/installningar">Ange tentadatum</Link> så planeras repetitionen fram till tentan.
            </p>
          )}
        </div>

        <div className="tiles">
          <Link to={`/ova/${courseId}`} className="tile">
            <TileIconPractice />
            <div>
              <strong>Övningspass</strong>
              <span className="muted small">Blandade ämnen</span>
            </div>
          </Link>
          <Link to={`/kurs/${courseId}/tentasimulering`} className="tile">
            <TileIconExam />
            <div>
              <strong>Tentasimulering</strong>
              <span className="muted small">Tidsatt, som på riktigt</span>
            </div>
          </Link>
          <Link to={`/kurs/${courseId}/felbank`} className="tile">
            <TileIconMistakes />
            <div>
              <strong>Felbank</strong>
              <span className="muted small">
                {mistakes ? `${mistakes} ${mistakes === 1 ? 'fråga' : 'frågor'}` : 'Tom just nu'}
              </span>
            </div>
          </Link>
          <Link to={`/kurs/${courseId}/tackning`} className="tile">
            <TileIconMap />
            <div>
              <strong>Täckningskarta</strong>
              <span className="muted small">
                {gaps ? `${gaps} ${gaps === 1 ? 'lucka' : 'luckor'} hittade` : 'Inga luckor'}
              </span>
            </div>
          </Link>
        </div>

        <div className="card due-card">
          <div>
            <div className="muted small">att repetera</div>
            <h3>{dueToday ? `${dueToday} kort väntar idag` : 'Inget att repetera just nu'}</h3>
          </div>
          <span className="count-bubble">{dueToday}</span>
        </div>

        <Link to={`/ova/${courseId}`} className="btn btn-primary btn-block">
          <IconBolt width={18} height={18} />
          Starta plugget
        </Link>
      </div>

      <h2 className="section-title">Ämnen</h2>
      <div className="grid-2 grid-auto">
        {stats.map((t) => (
          <Link
            key={t.topic}
            to={`/ova/${courseId}?amne=${encodeURIComponent(t.topic)}`}
            className="topic-tile"
          >
            <span className="topic-dot" style={{ background: topicColor(t.topic) }} />
            <strong>{topicName(t.topic)}</strong>
            <span className="muted small">
              {t.total} frågor{t.due ? ` · ${t.due} att repetera` : ''}
            </span>
            <span className="bar thin">
              <span style={{ width: `${(t.mastered / t.total) * 100}%` }} />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="section-title">Gamla tentor</h2>
      <div className="exam-list">
        {exams.map((e) => (
          <Link key={e} to={`/ova/${courseId}?tenta=${encodeURIComponent(e)}`} className="exam-chip">
            {e}
          </Link>
        ))}
      </div>
    </section>
  )
}

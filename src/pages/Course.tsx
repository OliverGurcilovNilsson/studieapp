import { Link, useParams } from 'react-router-dom'
import { SETTINGS } from '../data/settings'
import { getSetting, loadCourseData, predictedRecall, topicStats } from '../data/queries'
import { buildQueue } from '../lib/session'
import { topicColor, topicName } from '../lib/topics'
import { IconBack, IconBolt, Mascot } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

export function Course() {
  const { courseId = '' } = useParams()
  const { data, loading } = useAsync(async () => {
    const cd = await loadCourseData(courseId)
    if (!cd) return undefined
    const now = Date.now()
    const examDate = await getSetting<number | undefined>(SETTINGS.examDate(courseId), undefined)
    const stats = topicStats(cd, now)
    const total = stats.reduce((a, t) => a + t.total, 0)
    const mastered = stats.reduce((a, t) => a + t.mastered, 0)
    const dueToday = buildQueue(cd.questions, cd.states, now, { limit: 999, newLimit: 0 }).length
    const exams = [...new Set(cd.questions.map((q) => q.examId).filter(Boolean) as string[])].sort().reverse()
    const forecast = examDate && examDate > now ? predictedRecall(cd, examDate) : undefined
    const daysLeft = examDate ? Math.ceil((examDate - now) / 86_400_000) : undefined
    return { cd, stats, total, mastered, dueToday, exams, examDate, forecast, daysLeft }
  }, [courseId])

  if (loading) return null
  if (!data) return <p>Kursen finns inte. <Link to="/">Till biblioteket</Link></p>
  const { cd, stats, total, mastered, dueToday, exams, examDate, forecast, daysLeft } = data
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
        <div className="card">
          <div className="row-between">
            <span>Behärskat</span>
            <strong>{pct}%</strong>
          </div>
          <div className="bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          {forecast !== undefined && (
            <p className="forecast">
              Beräknad kunskap på tentadagen: <strong>{Math.round(forecast * 100)} %</strong>
              <span className="muted"> · {daysLeft} dagar kvar (uppskattning)</span>
            </p>
          )}
          {!examDate && (
            <p className="muted small">
              <Link to="/installningar">Ange tentadatum</Link> så planeras repetitionen fram till tentan.
            </p>
          )}
        </div>

        <div className="card row-between">
          <div>
            <div className="muted small">att repetera</div>
            <h3>{dueToday ? `${dueToday} kort väntar idag` : 'Inget att repetera just nu'}</h3>
          </div>
          <span className="count-bubble">{dueToday}</span>
        </div>
      </div>

      <Link to={`/ova/${courseId}`} className="btn btn-primary btn-block">
        <IconBolt width={18} height={18} />
        Starta plugget
      </Link>

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

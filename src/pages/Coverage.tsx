import { Link, useParams } from 'react-router-dom'
import { loadCourseData } from '../data/queries'
import { db } from '../db/db'
import { coverage } from '../lib/coverage'
import { topicName } from '../lib/topics'
import { IconBack, IconBolt } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

export function Coverage() {
  const { courseId = '' } = useParams()
  const { data, loading } = useAsync(async () => {
    const cd = await loadCourseData(courseId)
    if (!cd) return undefined
    const objectives = await db.objectives.where({ courseId }).toArray()
    return coverage(cd.questions, cd.states, objectives)
  }, [courseId])

  if (loading) return null
  if (!data) return <p>Kursen finns inte.</p>
  const pct = data.total ? Math.round((data.mastered / data.total) * 100) : 0
  const share = (n: number, total: number) => `${total ? (n / total) * 100 : 0}%`
  const gaps = data.topics.some((t) => t.total > t.mastered)

  return (
    <section className="coverage">
      <div className="page-head">
        <Link to={`/kurs/${courseId}`} className="icon-btn" aria-label="Tillbaka">
          <IconBack />
        </Link>
        <span className="page-title">Täckningskarta</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="coverage-top">
        <div className="big-number huge">{pct}%</div>
        <div>
          av kursen
          <br />
          behärskad
        </div>
      </div>

      <div className="legend">
        <span>
          <i className="seg-mastered" />
          Behärskad
        </span>
        <span>
          <i className="seg-seen" />
          Sedd
        </span>
        <span>
          <i className="seg-new" />
          Ej påbörjad
        </span>
      </div>

      <div className="coverage-rows">
        {data.topics.map((t) =>
          t.total === 0 ? (
            <div key={t.topic} className="coverage-gap">
              <div className="row-between">
                <strong>{topicName(t.topic)}</strong>
                <span className="small">Inga frågor än</span>
              </div>
              <div className="small">Lucka: det finns mål för ämnet men inga frågor i kursfilen.</div>
            </div>
          ) : (
            <div key={t.topic}>
              <div className="row-between coverage-label">
                <strong>{topicName(t.topic)}</strong>
                <span className="muted">
                  {data.examCount ? `på ${t.exams} av ${data.examCount} tentor` : `${t.total} frågor`}
                </span>
              </div>
              <div
                className="stacked"
                role="img"
                aria-label={`${t.mastered} behärskade, ${t.seen} sedda, ${t.notStarted} ej påbörjade av ${t.total}`}
              >
                <span className="seg-mastered" style={{ width: share(t.mastered, t.total) }} />
                <span className="seg-seen" style={{ width: share(t.seen, t.total) }} />
                <span className="seg-new" style={{ width: share(t.notStarted, t.total) }} />
              </div>
              {t.uncertain > 0 && (
                <div className="small muted">
                  {t.uncertain} {t.uncertain === 1 ? 'fråga' : 'frågor'} med osäkert facit
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {gaps && (
        <Link to={`/ova/${courseId}?luckor=1`} className="btn btn-primary btn-block coverage-cta">
          <IconBolt width={18} height={18} />
          Plugga luckorna
        </Link>
      )}
    </section>
  )
}

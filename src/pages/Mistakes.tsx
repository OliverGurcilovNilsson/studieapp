import { Link, useParams } from 'react-router-dom'
import { loadCourseData } from '../data/queries'
import { db } from '../db/db'
import { questionLabel } from '../lib/practice'
import { mistakeBank } from '../lib/mistakes'
import { topicName } from '../lib/topics'
import { IconBack, IconBolt, Mascot } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

export function Mistakes() {
  const { courseId = '' } = useParams()
  const { data, loading } = useAsync(async () => {
    const cd = await loadCourseData(courseId)
    if (!cd) return undefined
    const log = await db.reviewLog.where({ courseId }).toArray()
    return mistakeBank(cd.questions, cd.states, log)
  }, [courseId])

  if (loading) return null
  if (!data) return <p>Kursen finns inte.</p>

  return (
    <section className="mistakes-page">
      <div className="page-head">
        <Link to={`/kurs/${courseId}`} className="icon-btn" aria-label="Tillbaka">
          <IconBack />
        </Link>
        <span className="page-title">Felbank</span>
        <span style={{ width: 44 }} />
      </div>

      {data.length === 0 ? (
        <div className="empty">
          <Mascot size={96} />
          <h1>Tom felbank</h1>
          <p>Här hamnar frågor du har glömt två gånger eller senast svarade "Igen" på.</p>
        </div>
      ) : (
        <>
          <p className="muted">
            {data.length} {data.length === 1 ? 'fråga' : 'frågor'} som du har glömt minst två gånger eller senast svarade
            "Igen" på.
          </p>
          <Link
            to={`/ova/${courseId}?fragor=${data.map((m) => encodeURIComponent(m.question.id)).join(',')}`}
            className="btn btn-primary btn-block"
          >
            <IconBolt width={18} height={18} />
            Öva felbanken
          </Link>
          <ul className="mistake-list">
            {data.map((m) => (
              <li key={m.question.id}>
                <Link to={`/ova/${courseId}?fragor=${encodeURIComponent(m.question.id)}`} className="mistake">
                  <span className="eyebrow">{questionLabel(m.question, topicName)}</span>
                  <span className="mistake-prompt">{m.question.prompt}</span>
                  <span className="mistake-tags">
                    {m.lastRatedAgain && <span className="badge">Senast: Igen</span>}
                    {m.misses > 0 && (
                      <span className="badge badge-outline">
                        Missad {m.misses} {m.misses === 1 ? 'gång' : 'gånger'}
                      </span>
                    )}
                    {m.lapses >= 2 && <span className="badge badge-soft">Glömd {m.lapses} gånger</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

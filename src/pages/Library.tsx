import { Link } from 'react-router-dom'
import { loadCourseData, loadCourses, topicStats } from '../data/queries'
import { topicColor } from '../lib/topics'
import { IconPlus, Mascot } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

export function Library() {
  const { data, loading } = useAsync(async () => {
    const courses = await loadCourses()
    const now = Date.now()
    return Promise.all(
      courses.map(async (course) => {
        const cd = (await loadCourseData(course.id))!
        const stats = topicStats(cd, now)
        const total = stats.reduce((a, t) => a + t.total, 0)
        const mastered = stats.reduce((a, t) => a + t.mastered, 0)
        const due = stats.reduce((a, t) => a + t.due, 0)
        return { course, total, mastered, due }
      }),
    )
  }, [])

  if (loading) return null

  if (!data?.length) {
    return (
      <section className="empty">
        <Mascot size={96} />
        <h1>Välkommen!</h1>
        <p>Importera en kursfil för att börja plugga. Kursfilen får du av den som har tagit fram innehållet.</p>
        <Link className="btn btn-primary" to="/installningar#import">
          <IconPlus width={18} height={18} />
          Importera kurs
        </Link>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <h1>Mina kurser</h1>
        <Link className="btn" to="/installningar#import">
          <IconPlus width={18} height={18} />
          Importera
        </Link>
      </div>
      <div className="deck-grid">
        {data.map(({ course, total, mastered, due }, i) => (
          <Link
            key={course.id}
            to={`/kurs/${course.id}`}
            className="deck"
            style={{ background: topicColor(course.id), rotate: `${i % 2 ? 1.5 : -1.5}deg` }}
          >
            <span className="deck-badge">{course.code}</span>
            <span className="deck-title">{course.name}</span>
            <span className="deck-meta">
              <span>{total} frågor</span>
              <span>{total ? Math.round((mastered / total) * 100) : 0}%</span>
            </span>
            <span className="bar bar-on-accent">
              <span style={{ width: `${total ? (mastered / total) * 100 : 0}%` }} />
            </span>
            {due > 0 && <span className="deck-due">{due} att repetera</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}

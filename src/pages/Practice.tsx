import { Link, Navigate } from 'react-router-dom'
import { loadCourses } from '../data/queries'
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

export function Practice() {
  return null
}

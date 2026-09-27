import { Link } from 'react-router-dom'
import { backupReminderDue } from '../data/backup'
import { getSetting, loadCourseData, loadCourses, topicStats } from '../data/queries'
import { SETTINGS } from '../data/settings'
import { db } from '../db/db'
import { SampleButton } from '../dev/SampleButton'
import { learnedThisWeek, streakDays } from '../lib/stats'
import { topicColor, topicName } from '../lib/topics'
import { DeckIcon, IconAlert, IconArrow, IconCards, IconFlame, IconPlus, Mascot } from '../ui/icons'
import { useAsync } from '../ui/useAsync'

const TILTS = ['-3deg', '2.5deg', '-1.5deg', '3deg', '-2deg', '1.5deg']

export function Library() {
  const { data, loading, reload } = useAsync(async () => {
    const courses = await loadCourses()
    const now = Date.now()
    const [lastBackupAt, log] = await Promise.all([
      getSetting<number | undefined>(SETTINGS.lastBackupAt, undefined),
      db.reviewLog.where('ts').above(now - 400 * 86_400_000).toArray(),
    ])
    const backupDue = backupReminderDue(lastBackupAt, (await db.reviewStates.count()) > 0, now)
    const sections = await Promise.all(
      courses.map(async (course) => {
        const cd = (await loadCourseData(course.id))!
        const exams = new Set(cd.questions.map((q) => q.examId).filter(Boolean)).size
        return { course, stats: topicStats(cd, now), exams }
      }),
    )
    return {
      sections,
      backupDue,
      learned: learnedThisWeek(log, now),
      streak: streakDays(
        log.map((e) => e.ts),
        now,
      ),
      exams: sections.reduce((a, s) => a + s.exams, 0),
    }
  }, [])

  if (loading) return null

  if (!data?.sections.length) {
    return (
      <section className="empty">
        <Mascot size={96} />
        <h1>Välkommen!</h1>
        <p>Importera en kursfil för att börja plugga. Kursfilen får du av den som har tagit fram innehållet.</p>
        <Link className="btn btn-primary" to="/installningar#import">
          <IconPlus width={18} height={18} />
          Importera kurs
        </Link>
        {import.meta.env.DEV && <SampleButton onLoaded={reload} />}
      </section>
    )
  }

  return (
    <section className="library">
      <div className="page-head">
        <h1>Mina kurser</h1>
      </div>

      {data.backupDue && (
        <Link to="/installningar#backup" className="notice notice-link">
          <IconAlert />
          <div>
            <strong>Dags för säkerhetskopia</strong>
            <p className="small">Allt sparas bara på den här enheten. Exportera en kopia i Inställningar.</p>
          </div>
        </Link>
      )}

      {data.sections.map(({ course, stats }) => (
        <div key={course.id} className="library-course">
          <Link to={`/kurs/${course.id}`} className="course-link">
            <span className="eyebrow">
              {course.code} · {course.name}
            </span>
            <span className="course-link-cta">
              Kursöversikt <IconArrow width={16} height={16} />
            </span>
          </Link>
          <div className="deck-grid">
            {stats.map((t, i) => {
              const pct = t.total ? Math.round((t.mastered / t.total) * 100) : 0
              return (
                <Link
                  key={t.topic}
                  to={`/ova/${course.id}?amne=${encodeURIComponent(t.topic)}`}
                  className="deck"
                  style={{ background: topicColor(t.topic), rotate: TILTS[i % TILTS.length] }}
                >
                  <span className="deck-top">
                    <span className="deck-badge">ÄMNE</span>
                    <DeckIcon seed={t.topic} />
                  </span>
                  <span className="deck-title">{topicName(t.topic)}</span>
                  <span className="deck-meta">
                    <span>{t.total} kort</span>
                    <span>{pct}%</span>
                  </span>
                  <span className="bar bar-on-accent">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  {t.due > 0 && <span className="deck-due">{t.due} att repetera</span>}
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      <div className="library-cta">
        <Link className="btn btn-primary" to="/installningar#import">
          <IconPlus width={18} height={18} />
          Lägg till kurs
        </Link>
      </div>

      <div className="week">
        <div className="muted">Lärt denna vecka</div>
        <div className="big-number">{data.learned} kort</div>
        <div className="week-stats">
          <div>
            <IconCards />
            <div>
              <div className="muted small">Tentor</div>
              <strong>{data.exams}</strong>
            </div>
          </div>
          <div>
            <IconFlame />
            <div>
              <div className="muted small">Streak</div>
              <strong>
                {data.streak} {data.streak === 1 ? 'dag' : 'dagar'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

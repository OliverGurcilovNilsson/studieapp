import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  backupFileName,
  backupReminderDue,
  exportBackup,
  parseBackup,
  restoreProgress,
} from '../data/backup'
import { getSetting, loadCourses, setSetting } from '../data/queries'
import { DEFAULT_MINUTES_PER_DAY, examDateFromInput, examDateToInput, SETTINGS } from '../data/settings'
import { db } from '../db/db'
import { describeImport, importCourse, parseBundle } from '../db/importCourse'
import { SampleButton } from '../dev/SampleButton'
import { IconAlert, IconPlus } from '../ui/icons'
import { applyTheme, type Theme } from '../ui/theme'
import { useAsync } from '../ui/useAsync'

type Status = { kind: 'ok' | 'error'; text: string } | undefined

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function requestPersistence() {
  if (await getSetting(SETTINGS.persistRequested, false)) return
  await setSetting(SETTINGS.persistRequested, true)
  await navigator.storage?.persist?.().catch(() => false)
}

export function Settings() {
  const { hash } = useLocation()
  const { data, reload } = useAsync(async () => {
    const courses = await loadCourses()
    const examDates = Object.fromEntries(
      await Promise.all(
        courses.map(async (c) => [c.id, await getSetting<number | undefined>(SETTINGS.examDate(c.id), undefined)] as const),
      ),
    )
    const [minutes, theme, lastBackupAt, progressCount, persisted] = await Promise.all([
      getSetting(SETTINGS.minutesPerDay, DEFAULT_MINUTES_PER_DAY),
      getSetting<Theme>(SETTINGS.theme, 'auto'),
      getSetting<number | undefined>(SETTINGS.lastBackupAt, undefined),
      db.reviewStates.count(),
      navigator.storage?.persisted?.().catch(() => false) ?? Promise.resolve(false),
    ])
    return { courses, examDates, minutes, theme, lastBackupAt, progressCount, persisted, now: Date.now() }
  }, [])

  useEffect(() => {
    if (hash && data) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, data])

  if (!data) return null
  const reminder = backupReminderDue(data.lastBackupAt, data.progressCount > 0, data.now)

  return (
    <section className="settings">
      <div className="page-head">
        <h1>Inställningar</h1>
      </div>

      {reminder && <BackupReminder lastBackupAt={data.lastBackupAt} />}

      <ImportCard onImported={reload} />

      {data.courses.length > 0 && (
        <div className="card settings-card">
          <h2>Tentadatum</h2>
          <p className="muted small">Med ett datum planeras repetitionen så att allt kommer tillbaka före tentan.</p>
          {data.courses.map((c) => (
            <label key={c.id} className="field">
              <span>
                {c.code} · {c.name}
              </span>
              <input
                type="date"
                defaultValue={examDateToInput(data.examDates[c.id])}
                onChange={async (e) => {
                  const epoch = examDateFromInput(e.target.value)
                  await setSetting(SETTINGS.examDate(c.id), epoch)
                }}
              />
            </label>
          ))}
        </div>
      )}

      <div className="card settings-card">
        <h2>Studietid</h2>
        <label className="field">
          <span>Minuter per dag</span>
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            inputMode="numeric"
            defaultValue={data.minutes}
            onChange={async (e) => {
              const n = Number(e.target.value)
              if (n >= 5 && n <= 240) await setSetting(SETTINGS.minutesPerDay, n)
            }}
          />
        </label>
        <p className="muted small">Används av tentaläget för att fylla dagens pass.</p>
      </div>

      <div className="card settings-card">
        <h2>Utseende</h2>
        <div className="segmented segmented-3" role="group" aria-label="Tema">
          {(
            [
              ['auto', 'Auto'],
              ['light', 'Ljust'],
              ['dark', 'Mörkt'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={data.theme === value}
              onClick={async () => {
                applyTheme(value)
                await setSetting(SETTINGS.theme, value)
                reload()
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <BackupCard lastBackupAt={data.lastBackupAt} persisted={data.persisted} onChange={reload} />
    </section>
  )
}

function BackupReminder({ lastBackupAt }: { lastBackupAt?: number }) {
  return (
    <div className="notice">
      <IconAlert />
      <div>
        <strong>Dags för säkerhetskopia</strong>
        <p className="small">
          {lastBackupAt
            ? `Senaste kopian gjordes ${new Date(lastBackupAt).toLocaleDateString('sv-SE')}.`
            : 'Du har inte gjort någon säkerhetskopia än.'}{' '}
          Allt sparas bara på den här enheten, så exportera en kopia varje vecka.
        </p>
      </div>
    </div>
  )
}

function ImportCard({ onImported }: { onImported: () => void }) {
  const [status, setStatus] = useState<Status>()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    setBusy(true)
    setStatus(undefined)
    try {
      const bundle = parseBundle(await file.text())
      const result = await importCourse(db, bundle)
      await requestPersistence()
      setStatus({ kind: 'ok', text: describeImport(bundle.course.name, result) })
      onImported()
    } catch (e) {
      setStatus({ kind: 'error', text: errorText(e) })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="card settings-card" id="import">
      <h2>Importera kurs</h2>
      <p className="muted small">
        Välj kursfilen (.json). Importerar du samma kurs igen ersätts innehållet, men dina framsteg finns kvar.
      </p>
      <div className="row-wrap">
        <label className={`btn btn-primary ${busy ? 'is-busy' : ''}`}>
          <IconPlus width={18} height={18} />
          {busy ? 'Importerar…' : 'Välj kursfil'}
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        {import.meta.env.DEV && <SampleButton onLoaded={onImported} />}
      </div>
      {status && (
        <p className={status.kind === 'error' ? 'error' : 'ok'} role="status">
          {status.text}
        </p>
      )}
    </div>
  )
}

function BackupCard({
  lastBackupAt,
  persisted,
  onChange,
}: {
  lastBackupAt?: number
  persisted: boolean
  onChange: () => void
}) {
  const [status, setStatus] = useState<Status>()
  const input = useRef<HTMLInputElement>(null)

  async function onExport() {
    try {
      const backup = await exportBackup(db)
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName()
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await setSetting(SETTINGS.lastBackupAt, backup.exportedAt)
      setStatus({ kind: 'ok', text: 'Säkerhetskopian är sparad i Hämtade filer.' })
      onChange()
    } catch (e) {
      setStatus({ kind: 'error', text: errorText(e) })
    }
  }

  async function onRestore(file: File) {
    try {
      const backup = parseBackup(await file.text())
      const when = new Date(backup.exportedAt).toLocaleString('sv-SE')
      const ok = window.confirm(
        `Återställa framsteg från säkerhetskopian (${when})?\n\nFrågor du har övat på efter kopian behåller sina nyare framsteg. Kursinnehållet ändras inte.`,
      )
      if (!ok) return
      const r = await restoreProgress(db, backup)
      setStatus({ kind: 'ok', text: `Klart: ${r.states} kort och ${r.logEntries} repetitioner återställda.` })
      onChange()
    } catch (e) {
      setStatus({ kind: 'error', text: errorText(e) })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="card settings-card" id="backup">
      <h2>Säkerhetskopia</h2>
      <p className="muted small">
        {lastBackupAt
          ? `Senaste kopian: ${new Date(lastBackupAt).toLocaleDateString('sv-SE')}.`
          : 'Ingen säkerhetskopia gjord än.'}{' '}
        {persisted ? 'Webbläsaren har lovat att inte rensa appens data.' : ''}
      </p>
      <div className="row-wrap">
        <button className="btn btn-dark" onClick={onExport}>
          Exportera säkerhetskopia
        </button>
        <label className="btn btn-outline">
          Återställ från säkerhetskopia
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onRestore(e.target.files[0])}
          />
        </label>
      </div>
      {status && (
        <p className={status.kind === 'error' ? 'error' : 'ok'} role="status">
          {status.text}
        </p>
      )}
    </div>
  )
}

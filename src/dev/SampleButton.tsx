import { useState } from 'react'
import { loadSampleCourse } from './sampleCourse'

/** "Ladda exempelkurs". Render only behind `import.meta.env.DEV` so production builds drop it. */
export function SampleButton({ onLoaded }: { onLoaded?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  return (
    <>
      <button
        className="btn btn-outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(undefined)
          try {
            await loadSampleCourse()
            onLoaded?.()
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Laddar…' : 'Ladda exempelkurs'}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  )
}

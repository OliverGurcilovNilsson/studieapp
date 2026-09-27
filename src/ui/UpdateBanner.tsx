import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** Registers the service worker and shows "Ny version – ladda om" when an update has taken over. */
export function UpdateBanner() {
  const [state, setState] = useState<'idle' | 'offline-ready' | 'update'>('idle')

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
    // A new worker can activate before workbox-window attaches its listeners (skipWaiting),
    // so a controller change on a page that already had one also means "new version".
    const hadController = !!navigator.serviceWorker.controller
    const onChange = () => hadController && setState('update')
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    registerSW({
      immediate: true,
      onNeedReload: () => setState('update'),
      onOfflineReady: () => setState('offline-ready'),
      // The app can stay open for days (hash routing never navigates), so look for updates hourly.
      onRegisteredSW: (_url, registration) => {
        if (registration) setInterval(() => registration.update().catch(() => {}), 3_600_000)
      },
    })
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  if (state === 'idle') return null
  return (
    <div className="update-banner" role="status">
      {state === 'update' ? (
        <>
          <span>Ny version av appen finns.</span>
          <button className="btn btn-primary btn-small" onClick={() => window.location.reload()}>
            Ladda om
          </button>
        </>
      ) : (
        <>
          <span>Appen fungerar nu utan internet.</span>
          <button className="btn btn-small" onClick={() => setState('idle')}>
            OK
          </button>
        </>
      )}
    </div>
  )
}

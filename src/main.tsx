import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { snapshotBeforeUpgrade } from './db/preUpgradeSnapshot'
import { AppRoutes } from './routes'
import './styles/app.css'
import './styles/practice.css'
import { initTheme } from './ui/theme'

// Copy the database aside before a new schema version upgrades it, then start the app
// (which opens the database and runs the upgrade).
snapshotBeforeUpgrade()
  .catch((e) => console.error('Kunde inte ta en kopia före uppgraderingen', e))
  .finally(() => {
    initTheme()
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppRoutes />
      </StrictMode>,
    )
  })

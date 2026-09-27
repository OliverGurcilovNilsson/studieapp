import { getSetting } from '../data/queries'
import { SETTINGS } from '../data/settings'

export type Theme = 'auto' | 'light' | 'dark'

/** Sets data-theme on <html> (tokens.css reads it) and mirrors it to localStorage for a flash-free start. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    localStorage.setItem(SETTINGS.theme, theme)
  } catch {
    // Storage can be blocked; the Dexie setting is the source of truth anyway.
  }
}

export function initTheme() {
  try {
    const cached = localStorage.getItem(SETTINGS.theme) as Theme | null
    if (cached) applyTheme(cached)
  } catch {
    // ignore
  }
  getSetting<Theme>(SETTINGS.theme, 'auto').then(applyTheme, () => {})
}

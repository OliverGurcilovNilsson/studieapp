import { NavLink, Outlet } from 'react-router-dom'
import { IconBolt, IconLibrary, IconSettings, Mascot } from './icons'

/** Bottom nav on phones, sidebar from 900px (see app.css). */
export function Shell() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Huvudmeny">
        <div className="brand">
          <Mascot size={36} />
          Pluggappen
        </div>
        <NavLink to="/" end>
          <IconLibrary />
          Bibliotek
        </NavLink>
        <NavLink to="/ova">
          <IconBolt />
          Öva
        </NavLink>
        <NavLink to="/installningar">
          <IconSettings />
          Inställningar
        </NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

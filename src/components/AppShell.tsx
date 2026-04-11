import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-brand">
          <div className="site-mark">JT</div>
          <div>
            <p className="site-title">Jira Ticket Workspace</p>
            <p className="site-subtitle">Track, refine, and implement from one interface</p>
          </div>
        </div>

        <nav className="site-nav">
          <NavLink
            to="/issues"
            className={({ isActive }) => `site-nav-link ${isActive ? 'site-nav-link-active' : ''}`}
          >
            Issues
          </NavLink>
        </nav>
      </header>

      <main className="site-main">{children}</main>
    </div>
  )
}

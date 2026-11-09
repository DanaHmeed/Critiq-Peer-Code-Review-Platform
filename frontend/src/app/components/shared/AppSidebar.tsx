import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../context/AuthContext'
import { PublicBrand } from '../public/PublicBrand'
import { WorkspaceIcon, type WorkspaceIconName } from './WorkspaceIcon'

const links: { to: string; label: string; icon: WorkspaceIconName }[] = [
  { to: '/dashboard', label: 'Your workbench', icon: 'home' },
  { to: '/my-requests', label: 'Your reviews', icon: 'reviews' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/profile', label: 'Your profile', icon: 'person' },
]

export function AppSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!mobileOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); toggle.current?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [mobileOpen])

  async function handleLogout() {
    setSigningOut(true)
    try { if (await logout()) navigate('/login', { replace: true }) }
    finally { setSigningOut(false) }
  }

  return <aside className={`cq-side${mobileOpen ? ' cq-side-open' : ''}`} aria-label="Workspace navigation">
    <div className="cq-side-heading"><PublicBrand /><button ref={toggle} className="cq-menu-toggle" type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setMobileOpen(!mobileOpen)}><WorkspaceIcon name={mobileOpen ? 'close' : 'menu'} /></button></div>
    <div id="workspace-navigation" className="cq-side-body">
      <Link to="/create-request" className="wk-button cq-side-create" onClick={() => setMobileOpen(false)}><WorkspaceIcon name="plus" />Request a review</Link>
      <nav aria-label="Workspace"><div className="cq-side-links">{links.map(link => <NavLink key={link.to} to={link.to} className={({ isActive }) => `cq-side-link${isActive ? ' is-active' : ''}`}><WorkspaceIcon name={link.icon} />{link.label}</NavLink>)}</div>
        {(isAdmin || user?.role === 'admin') && <NavLink to="/admin" className="cq-side-link"><WorkspaceIcon name="shield" />Administration</NavLink>}
      </nav>
      <div className="cq-side-thought"><span aria-hidden="true">{'{ }'}</span><p>A good question is<br />a contribution, too.</p></div>
      <div className="cq-side-bottom"><NavLink to="/settings" className="cq-side-link"><WorkspaceIcon name="settings" />Settings</NavLink><div className="cq-side-person"><span className="wk-initial" aria-hidden="true">{user?.name?.slice(0, 1).toUpperCase() || 'C'}</span><div><strong>{user?.name || 'Developer'}</strong><span>{user?.role || 'requester'}</span></div></div><div className="cq-side-utilities"><button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><WorkspaceIcon name={theme === 'dark' ? 'sun' : 'moon'} />{theme === 'dark' ? 'Light paper' : 'Dark paper'}</button><button type="button" disabled={signingOut} onClick={handleLogout}><WorkspaceIcon name="exit" />{signingOut ? 'Signing out…' : 'Sign out'}</button></div></div>
    </div>
  </aside>
}

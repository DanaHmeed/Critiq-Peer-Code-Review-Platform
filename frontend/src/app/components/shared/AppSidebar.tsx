import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  FileCode,
  Bell,
  User,
  Settings,
  Shield,
  Moon,
  Sun,
  Menu,
  X,
  Plus,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useTheme } from "../../hooks/useTheme"
import { cn } from '../ui/utils'
import { useAuth } from '../../context/AuthContext'
import { UserAvatar } from './Useravatar'

interface SidebarLinkProps {
  to: string
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number | string
  shortcut?: string
  onClick?: () => void
}

function SidebarLink({ to, icon, label, active, badge, shortcut, onClick }: SidebarLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150',
        active
          ? 'bg-white/[0.08] text-[#f7f8f8] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'text-[#8a8f98] hover:bg-white/[0.04] hover:text-[#f7f8f8]'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn('shrink-0 transition-colors', active ? 'text-[#5e6ad2]' : 'text-[#8a8f98] group-hover:text-[#f7f8f8]')}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {badge !== undefined && badge !== 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#5e6ad2]/20 text-[#8b95ea] border border-[#5e6ad2]/30">
            {badge}
          </span>
        )}
        {shortcut && (
          <span className="opacity-0 group-hover:opacity-100 text-[10px] font-mono text-[#525660] transition-opacity">
            {shortcut}
          </span>
        )}
      </div>
    </Link>
  )
}

interface AppSidebarProps {
  isAdmin?: boolean
}

export function AppSidebar({ isAdmin = false }: AppSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const showAdmin = isAdmin || user?.role === 'admin'

  const handleLogout = async () => {
    if (await logout()) navigate('/login', { replace: true })
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0a0b0e] text-[#f7f8f8] border-r border-white/[0.06] select-none">
      {/* Workspace Header */}
      <div className="p-3 border-b border-white/[0.06]">
        <Link to="/" className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5e6ad2] to-[#3a4491] flex items-center justify-center shadow-[0_0_12px_rgba(94,106,210,0.35)]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-tight text-[#f7f8f8] flex items-center gap-1.5">
                Critiq
                <span className="text-[9px] px-1 py-0.2 rounded bg-white/[0.08] text-[#8a8f98] font-mono">v1.0</span>
              </div>
              <div className="text-[10px] text-[#8a8f98] truncate max-w-[120px]">
                {user?.name ? `${user.name}'s space` : 'Peer Reviews'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#525660]" />
        </Link>

        {/* Quick Action Button */}
        <Link to="/create-request" className="block mt-3">
          <button className="w-full h-8 px-3 rounded-lg bg-[#5e6ad2] hover:bg-[#6f7de3] text-white text-xs font-medium flex items-center justify-between shadow-[0_0_12px_rgba(94,106,210,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all active:scale-[0.98]">
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Request
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/20 text-white/90">
              C
            </span>
          </button>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 p-2 space-y-4 overflow-y-auto scrollbar-thin">
        <div>
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#525660]">
            Workspace
          </div>
          <div className="space-y-0.5 mt-1">
            <SidebarLink
              to="/dashboard"
              icon={<LayoutDashboard className="w-3.5 h-3.5" />}
              label="Dashboard"
              active={location.pathname === '/dashboard'}
              shortcut="G D"
              onClick={() => setMobileOpen(false)}
            />
            <SidebarLink
              to="/my-requests"
              icon={<FileCode className="w-3.5 h-3.5" />}
              label="My Requests"
              active={location.pathname === '/my-requests'}
              shortcut="G R"
              onClick={() => setMobileOpen(false)}
            />
            <SidebarLink
              to="/notifications"
              icon={<Bell className="w-3.5 h-3.5" />}
              label="Notifications"
              active={location.pathname === '/notifications'}
              shortcut="G N"
              onClick={() => setMobileOpen(false)}
            />
            <SidebarLink
              to="/profile"
              icon={<User className="w-3.5 h-3.5" />}
              label="Profile & Stats"
              active={location.pathname === '/profile'}
              onClick={() => setMobileOpen(false)}
            />
          </div>
        </div>

        {showAdmin && (
          <div>
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#525660]">
              Administration
            </div>
            <div className="space-y-0.5 mt-1">
              <SidebarLink
                to="/admin"
                icon={<Shield className="w-3.5 h-3.5 text-rose-400" />}
                label="Admin Console"
                active={location.pathname === '/admin'}
                onClick={() => setMobileOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer / User Profile */}
      <div className="p-2 border-t border-white/[0.06] space-y-1">
        <SidebarLink
          to="/settings"
          icon={<Settings className="w-3.5 h-3.5" />}
          label="Settings"
          active={location.pathname === '/settings'}
          onClick={() => setMobileOpen(false)}
        />

        <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar name={user?.name || 'Developer'} size="sm" online />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate text-[#f7f8f8]">{user?.name || 'Developer'}</div>
              <div className="text-[10px] text-[#8a8f98] font-mono capitalize">{user?.role || 'requester'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-1 rounded text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.06] transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-1 rounded text-[#8a8f98] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[#0f1015] border border-white/[0.08] text-[#f7f8f8] shadow-lg backdrop-blur-md"
        aria-label="Open navigation"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-full z-50 w-64 shadow-2xl transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/[0.08] text-[#8a8f98]"
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  )
}

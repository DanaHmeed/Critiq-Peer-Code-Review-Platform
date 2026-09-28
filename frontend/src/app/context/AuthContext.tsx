import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import type { User } from '../../api/types'

export type AuthUser = User
interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  sessionError: string
  retrySession: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role: string) => Promise<void>
  completeGithub: (token: string) => Promise<void>
  logout: () => Promise<boolean>
  updateUser: (updates: Partial<AuthUser>) => void
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const generation = useRef(0)

  const clear = useCallback(() => {
    generation.current++
    localStorage.removeItem('critiq-token')
    localStorage.removeItem('critiq-user')
    setUser(null); setToken(null); setSessionError(''); setLoading(false)
  }, [])
  const persist = useCallback((nextToken: string, nextUser: AuthUser) => {
    generation.current++
    localStorage.setItem('critiq-token', nextToken)
    localStorage.setItem('critiq-user', JSON.stringify(nextUser))
    setToken(nextToken); setUser(nextUser); setSessionError(''); setLoading(false)
  }, [])
  const retrySession = useCallback(async () => {
    const current = ++generation.current
    const savedToken = localStorage.getItem('critiq-token')
    setLoading(true); setSessionError(''); setUser(null)
    if (!savedToken) { clear(); return }
    try {
      const { user } = await authApi.meWithToken(savedToken)
      if (current === generation.current) persist(savedToken, user)
    } catch (error) {
      if (current !== generation.current) return
      if (error instanceof ApiError && error.status === 401) clear()
      else { setSessionError('Unable to check your session. Check your connection and try again.'); setLoading(false) }
    }
  }, [clear, persist])
  useEffect(() => {
    // The callback establishes its own session; do not race it with restoration.
    if (window.location.pathname === '/auth/callback') setLoading(false)
    else void retrySession()
    const sync = (event: StorageEvent) => { if (!event.key || event.key === 'critiq-token') void retrySession() }
    window.addEventListener('storage', sync)
    window.addEventListener('critiq:session-invalid', clear)
    return () => {
      generation.current++
      window.removeEventListener('storage', sync)
      window.removeEventListener('critiq:session-invalid', clear)
    }
  }, [clear, retrySession])

  async function login(email: string, password: string) {
    const { token, user } = await authApi.login({ email, password })
    persist(token, user)
  }
  async function register(name: string, email: string, password: string, role: string) {
    const { token, user } = await authApi.register({ name, email, password, role })
    persist(token, user)
  }
  const completeGithub = useCallback(async (nextToken: string) => {
    generation.current++
    const { user } = await authApi.meWithToken(nextToken)
    persist(nextToken, user)
  }, [persist])
  async function logout() {
    try { if (localStorage.getItem('critiq-token')) await authApi.logout() }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        toast.error('Could not sign out. Check your connection and try again.')
        return false
      }
    }
    clear()
    return true
  }
  function updateUser(updates: Partial<AuthUser>) {
    setUser(previous => {
      if (!previous) return previous
      const updated = { ...previous, ...updates }
      localStorage.setItem('critiq-user', JSON.stringify(updated))
      return updated
    })
  }
  return <AuthContext.Provider value={{ user, token, loading, sessionError, retrySession, login, register, completeGithub, logout, updateUser }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

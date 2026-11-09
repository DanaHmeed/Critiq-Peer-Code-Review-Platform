import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { safeAuthDestination } from '../utils/authRedirect'

function SessionStatus() {
  const { sessionError, retrySession } = useAuth()
  return <main className="min-h-screen flex items-center justify-center p-6"><div role={sessionError ? 'alert' : 'status'}>
    <p>{sessionError || 'Checking your session…'}</p>
    {sessionError && <button onClick={() => void retrySession()} className="underline">Try again</button>}
  </div></main>
}
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionError } = useAuth()
  const location = useLocation()
  if (loading || sessionError) return <SessionStatus />
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />
}
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return <RequireAuth>{user && user.role !== 'admin' ? <Navigate to="/dashboard" replace /> : children}</RequireAuth>
}
export function PublicAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionError } = useAuth()
  const location = useLocation()
  if (loading || sessionError) return <SessionStatus />
  return user ? <Navigate to={safeAuthDestination(location.state?.from)} replace /> : <>{children}</>
}

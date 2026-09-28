import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { safeAuthDestination } from '../utils/authRedirect'

export function AuthCallback() {
  const { completeGithub } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
    window.history.replaceState(null, '', window.location.pathname)
    if (!token) { setError('Missing GitHub sign-in response. Please try again.'); return }
    const destination = safeAuthDestination(sessionStorage.getItem('critiq-return-to'))
    sessionStorage.removeItem('critiq-return-to')
    completeGithub(token).then(() => navigate(destination, { replace: true })).catch(() => setError('GitHub sign-in could not be completed. Please try again.'))
  }, [completeGithub, navigate])
  return <main className="min-h-screen flex items-center justify-center p-6">
    <div role={error ? 'alert' : 'status'}>
      <p>{error || 'Completing GitHub sign-in…'}</p>
      {error && <Link to="/login" className="underline">Back to sign in</Link>}
    </div>
  </main>
}

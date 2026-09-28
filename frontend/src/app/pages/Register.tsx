// frontend/src/app/pages/Register.tsx
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { safeAuthDestination } from '../utils/authRedirect'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'
import { Code, Eye, Github, Loader2 } from 'lucide-react'
import { authApi } from '../../api/auth'
import { cn } from '../components/ui/utils'

export function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const destination = safeAuthDestination(location.state?.from)
  const { register } = useAuth()
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: '' })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.role) { setError('Choose whether to request reviews or review code first.'); return }
    if (new TextEncoder().encode(formData.password).length > 72) { setError('Password must be at most 72 UTF-8 bytes.'); return }
    setError('')
    setLoading(true)
    try {
      await register(formData.name, formData.email, formData.password, formData.role)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-mono-display mb-2">Critiq</h1>
          </Link>
          <p className="text-sm text-[var(--muted)]">Create your account</p>
        </div>

        <div className="bg-[var(--surface)] border border-border rounded-md p-6 sm:p-8">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                autoComplete="name"
                maxLength={100}
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoComplete="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                autoComplete="new-password"
                type="password"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label>I want to</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'requester', icon: Code,  title: 'Request Reviews', desc: 'Submit code for feedback' },
                  { value: 'reviewer',  icon: Eye,   title: 'Review Code',     desc: 'Provide expert feedback' },
                ].map(({ value, icon: Icon, title, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: value })}
                    className={cn(
                      'p-4 border rounded-md text-left transition-all',
                      formData.role === value
                        ? 'border-[var(--accent)] bg-[var(--accent)]/8'
                        : 'border-border hover:border-[var(--accent)]/40 bg-transparent'
                    )}
                  >
                    <Icon className="w-5 h-5 mb-2 text-[var(--accent)]" />
                    <div className="text-sm font-medium text-foreground">{title}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={!formData.role || loading}
              className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 border-0 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
            </Button>
          </form>

          <Button type="button" variant="outline" className="w-full mt-5" disabled={loading}
            onClick={() => {
              if (!formData.role) { setError('Choose whether to request reviews or review code first.'); return }
              sessionStorage.setItem('critiq-return-to', destination)
              window.location.href = authApi.githubUrl(formData.role)
            }}>
            <Github className="w-4 h-4" /> Sign up with GitHub
          </Button>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Already have an account?{' '}
            <Link to="/login" state={{ from: destination }} className="text-[var(--accent)] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

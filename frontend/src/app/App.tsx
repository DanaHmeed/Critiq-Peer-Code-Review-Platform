// frontend/src/app/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { Toaster } from './components/ui/sonner'
import { AuthProvider, useAuth } from './context/AuthContext'

import { Landing }        from './pages/Landing'
import { Login }          from './pages/Login'
import { Register }       from './pages/Register'
import { Dashboard }      from './pages/Dashboard'
import { MyRequests }     from './pages/Myrequests'
import { CreateRequest }  from './pages/Createrequest'
import { ReviewDetails }  from './pages/Reviewdetails'
import { Notifications }  from './pages/Notifications'
import { Profile }        from './pages/Profile'
import { Settings }       from './pages/Settings'
import { AdminDashboard } from './pages/AdminDashboard'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { AuthCallback } from './pages/AuthCallback'


/* ── Guards ──────────────────────────────────────────────────────── */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null                              // prevent flash
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)                 return <Navigate to="/login"     replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/* ── Router ──────────────────────────────────────────────────────── */
function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />


        {/* Protected */}
        <Route path="/dashboard"      element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/my-requests"    element={<RequireAuth><MyRequests /></RequireAuth>} />
        <Route path="/create-request" element={<RequireAuth><CreateRequest /></RequireAuth>} />
        <Route path="/review/:id"     element={<RequireAuth><ReviewDetails /></RequireAuth>} />
        <Route path="/notifications"  element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/profile"        element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings"       element={<RequireAuth><Settings /></RequireAuth>} />

        {/* Admin only */}
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

/* ── Root ────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

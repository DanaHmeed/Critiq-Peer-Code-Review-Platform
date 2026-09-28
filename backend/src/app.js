const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const rateLimit  = require('express-rate-limit')

const authRoutes        = require('./routes/auth.routes')
const passwordResetRoutes = require('./routes/passwordReset.routes')
const requestRoutes     = require('./routes/request.routes')

const commentRoutes     = require('./routes/comment.routes')
const userRoutes        = require('./routes/user.routes')
const notifRoutes       = require('./routes/notif.routes')
const adminRoutes       = require('./routes/admin.routes')
const { errorHandler }  = require('./middleware/errorHandler')

const app = express()

// ── Security headers ─────────────────────────────
app.use(helmet())

// ── CORS ─────────────────────────────────────────
app.use(
  cors({
    origin: new URL(process.env.CLIENT_URL || 'http://localhost:5173').origin,
    credentials: true,
  })
)

// ── Rate limiting ────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
app.use('/api', limiter)

// ── Body parsing ─────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ─────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ───────────────────────────────────────
app.use('/api/auth',     authRoutes)
app.use('/api/auth',     passwordResetRoutes)
app.use('/api/requests', requestRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/notifs',   notifRoutes)
app.use('/api/admin',    adminRoutes)

// ── 404 ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ── Global error handler ─────────────────────────
app.use(errorHandler)

module.exports = app

const bcrypt = require('bcryptjs')
const { signToken } = require('../utils/tokens')
const { query } = require('../config/db')
const { asyncHandler } = require('../middleware/errorHandler')

// ── Helpers ───────────────────────────────────────────────────────
function sanitizeUser(user) {
  const { password_hash, ...safe } = user
  return safe
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body

  // Check duplicate email
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [email])
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, password_hash, role]
  )

  const user  = result.rows[0]
  const token = signToken(user)

  res.status(201).json({ token, user: sanitizeUser(user) })
})

// ── POST /api/auth/login ──────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  const result = await query('SELECT * FROM users WHERE lower(email) = $1', [email])
  const user   = result.rows[0]

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const token = signToken(user)

  res.json({ token, user: sanitizeUser(user) })
})

const getMe = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, bio, review_count, created_at FROM users WHERE id = $1',
    [req.user.id]
  )

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({ user: result.rows[0] })
})

module.exports = { register, login, getMe }

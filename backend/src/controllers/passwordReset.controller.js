const bcrypt = require('bcryptjs')
const { randomBytes, createHash } = require('node:crypto')
const { query } = require('../config/db')
const { asyncHandler } = require('../middleware/errorHandler')
const { emailConfigured, sendResetEmail } = require('../services/email')
const digest = token => createHash('sha256').update(token).digest('hex')
const genericResponse = { message: 'If an eligible account exists for that email, a reset link will be sent. Check your inbox and spam folder.' }

const forgotPassword = asyncHandler(async (req, res) => {
  if (!emailConfigured()) return res.status(503).json({ error: 'Password reset email is not configured. Contact the administrator.' })
  const user = (await query("SELECT id, email FROM users WHERE (lower(email) = $1 OR lower(email) = $2) AND role <> 'suspended' ORDER BY (lower(email) = $1) DESC LIMIT 1", [req.body.email, req.originalEmail])).rows[0]
  if (!user) return res.json(genericResponse)
  const token = randomBytes(32).toString('hex')
  const tokenHash = digest(token)
  const minutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return res.status(503).json({ error: 'Password reset is temporarily unavailable.' })
  await query(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
  [tokenHash, user.id, new Date(Date.now() + minutes * 60000)])
  const link = new URL('/reset-password', process.env.CLIENT_URL || 'http://localhost:5173')
  link.hash = new URLSearchParams({ token }).toString()
  try { await sendResetEmail(user.email, link.toString()) }
  catch {
    await query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash])
    // Do not log the token, recipient, provider response, or reveal account existence.
    console.error('Password reset email delivery failed.')
  }
  res.json(genericResponse)
})
const resetPassword = asyncHandler(async (req, res) => {
  const tokenHash = digest(req.body.token)
  const exists = await query('SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW()', [tokenHash])
  if (!exists.rows.length) return res.status(400).json({ error: 'Invalid or expired reset link. Request a new link.' })
  const passwordHash = await bcrypt.hash(req.body.newPassword, 12)
  // One atomic statement consumes the credential, changes the password, and
  // revokes all sessions. Concurrent redemption has only one winner.
  const updated = await query(`WITH consumed AS (
    DELETE FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id
  ), changed AS (
    UPDATE users SET password_hash = $2 WHERE id IN (SELECT user_id FROM consumed) AND role <> 'suspended' RETURNING id
  ), revoked AS (
    DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM changed)
  ) SELECT id FROM changed`, [tokenHash, passwordHash])
  if (!updated.rows.length) return res.status(400).json({ error: 'Invalid or expired reset link. Request a new link.' })
  res.json({ message: 'Password updated. Sign in with your new password.' })
})
module.exports = { forgotPassword, resetPassword }

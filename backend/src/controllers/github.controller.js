const { randomBytes, createHash, timingSafeEqual } = require('node:crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../config/db')
const { signToken } = require('../utils/tokens')
const { asyncHandler } = require('../middleware/errorHandler')
const { emailRule } = require('../middleware/authValidation')
const { validationResult } = require('express-validator')
const COOKIE = 'critiq-github-state'
const HANDOFF_COOKIE = 'critiq-github-handoff'
const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173'
const callbackUrl = () => process.env.GITHUB_CALLBACK_URL || `${(process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '')}/api/auth/github/callback`
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth/github' })
function fail(res, message) {
  const url = new URL('/login', clientUrl())
  url.searchParams.set('error', message)
  return res.redirect(url.toString())
}
function readCookie(req, name = COOKIE) {
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1)
}
async function githubJson(url, token) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'Critiq', 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!response.ok) throw new Error('GitHub unavailable')
  return response.json()
}
async function githubLogin(req, res) {
  res.set('Cache-Control', 'no-store')
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) return fail(res, 'GitHub login is not configured. Please use email and password.')
  const role = req.query.role || 'requester'
  if (!['requester', 'reviewer'].includes(role)) return fail(res, 'Choose a valid account role.')
  const state = randomBytes(32).toString('hex')
  const verifier = randomBytes(32).toString('base64url')
  const cookie = jwt.sign({ kind: 'github_state', state, verifier, role }, process.env.JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' })
  res.cookie(COOKIE, cookie, { ...cookieOptions(), maxAge: 10 * 60 * 1000 })
  const url = new URL('https://github.com/login/oauth/authorize')
  for (const [key, value] of Object.entries({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: callbackUrl(), scope: 'read:user user:email', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })) url.searchParams.set(key, value)
  return res.redirect(url.toString())
}
async function githubCallback(req, res) {
  res.set('Cache-Control', 'no-store')
  res.set('Referrer-Policy', 'no-referrer')
  res.clearCookie(COOKIE, cookieOptions())
  const { code, state, error } = req.query
  let saved
  try {
    saved = jwt.verify(readCookie(req), process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (saved.kind !== 'github_state' || typeof state !== 'string' || state.length !== saved.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) throw new Error('state')
  } catch {
    return fail(res, 'GitHub login expired or was started in another browser. Please try again.')
  }
  if (error) return fail(res, 'GitHub authorization was cancelled. Please try again.')
  if (typeof code !== 'string' || !code) return fail(res, 'Missing GitHub authorization response. Please try again.')
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Critiq' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: callbackUrl(), code_verifier: saved.verifier }),
    })
    const tokenData = await response.json()
    if (!response.ok || tokenData.error || !tokenData.access_token) return fail(res, 'GitHub authorization failed. Please try again.')
    const profile = await githubJson('https://api.github.com/user', tokenData.access_token)
    if (!Number.isSafeInteger(profile.id) || profile.id <= 0) throw new Error('Invalid identity')
    const githubId = String(profile.id)
    let user = (await query('SELECT * FROM users WHERE github_id = $1', [githubId])).rows[0]
    if (!user) {
      // Public profile.email is not proof of verification. Check the emails API.
      const emails = await githubJson('https://api.github.com/user/emails', tokenData.access_token)
      const verified = emails.find(item => item.verified && item.primary) || emails.find(item => item.verified)
      if (!verified?.email) return fail(res, 'Add a verified email to your GitHub account, then try again.')
      const emailRequest = { body: { email: verified.email } }
      await emailRule().run(emailRequest)
      if (!validationResult(emailRequest).isEmpty()) return fail(res, 'GitHub did not provide a usable verified email.')
      const email = emailRequest.body.email
      const existing = await query('SELECT id FROM users WHERE lower(email) = $1 OR lower(email) = $2', [email, emailRequest.originalEmail])
      if (existing.rows.length) return fail(res, 'An account already uses your GitHub email. Sign in with email and password; accounts are not linked automatically.')
      const passwordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12)
      user = (await query(`INSERT INTO users (name, email, password_hash, role, bio, github_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [(profile.name || profile.login || 'GitHub User').trim().slice(0, 100), email, passwordHash, saved.role, profile.bio || null, githubId])).rows[0]
    }
    if (user.role === 'suspended') return fail(res, 'This account is suspended. Contact the administrator.')
    const handoff = randomBytes(32).toString('hex')
    await query('DELETE FROM github_handoffs WHERE expires_at <= NOW()')
    await query("INSERT INTO github_handoffs (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 minute')", [createHash('sha256').update(handoff).digest('hex'), user.id])
    res.cookie(HANDOFF_COOKIE, handoff, { ...cookieOptions(), maxAge: 60000 })
    return res.redirect(new URL('/auth/callback', clientUrl()).toString())
  } catch (error) {
    return fail(res, error.code === '23505' ? 'This account was just registered. Please sign in again.' : 'GitHub sign-in is temporarily unavailable. Please try again.')
  }
}
const githubSession = asyncHandler(async (req, res) => {
  // The SPA must originate this request; cookie possession alone is not enough
  // for cross-origin scripts to force a session exchange.
  if (req.get('origin') !== new URL(clientUrl()).origin) return res.status(403).json({ error: 'Invalid sign-in origin' })
  const handoff = readCookie(req, HANDOFF_COOKIE)
  res.clearCookie(HANDOFF_COOKIE, cookieOptions())
  if (!handoff || !/^[a-f0-9]{64}$/.test(handoff)) return res.status(401).json({ error: 'GitHub sign-in expired. Please try again.' })
  const result = await query('DELETE FROM github_handoffs WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id', [createHash('sha256').update(handoff).digest('hex')])
  if (!result.rows[0]) return res.status(401).json({ error: 'GitHub sign-in expired. Please try again.' })
  const user = (await query('SELECT * FROM users WHERE id = $1', [result.rows[0].user_id])).rows[0]
  if (!user || user.role === 'suspended') return res.status(403).json({ error: 'This account is unavailable. Contact the administrator.' })
  const token = await signToken(user)
  const { password_hash, github_id, ...safe } = user
  res.json({ token, user: safe })
})
module.exports = { githubLogin, githubCallback, githubSession }

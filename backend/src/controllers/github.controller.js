const { randomBytes, createHash, timingSafeEqual } = require('node:crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../config/db')
const { signToken } = require('../utils/tokens')
const COOKIE = 'critiq-github-state'
const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173'
const callbackUrl = () => process.env.GITHUB_CALLBACK_URL || `${(process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '')}/api/auth/github/callback`
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth/github' })
function fail(res, message) {
  const url = new URL('/login', clientUrl())
  url.searchParams.set('error', message)
  return res.redirect(url.toString())
}
function readCookie(req) {
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
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
      const email = verified.email.trim().toLowerCase()
      const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [email])
      if (existing.rows.length) return fail(res, 'An account already uses your GitHub email. Sign in with email and password; accounts are not linked automatically.')
      const passwordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12)
      user = (await query(`INSERT INTO users (name, email, password_hash, role, bio, github_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [(profile.name || profile.login || 'GitHub User').trim().slice(0, 100), email, passwordHash, saved.role, profile.bio || null, githubId])).rows[0]
    }
    if (user.role === 'suspended') return fail(res, 'This account is suspended. Contact the administrator.')
    const callback = new URL('/auth/callback', clientUrl())
    // Fragments are never sent to web servers or in Referer headers. The client
    // removes this immediately, then validates the credential through /me.
    callback.hash = new URLSearchParams({ token: signToken(user) }).toString()
    return res.redirect(callback.toString())
  } catch (error) {
    return fail(res, error.code === '23505' ? 'This account was just registered. Please sign in again.' : 'GitHub sign-in is temporarily unavailable. Please try again.')
  }
}
module.exports = { githubLogin, githubCallback }

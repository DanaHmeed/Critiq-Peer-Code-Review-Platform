const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { randomUUID } = require('node:crypto')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

// Use an isolated schema. Never modify application users or print credentials.
const schemaName = `auth_test_${randomUUID().replaceAll('-', '')}`
const config = { host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
const admin = new Pool(config)
const db = new Pool({ ...config, options: `-c search_path=${schemaName},public` })
require('../src/config/db').query = (...args) => db.query(...args)
process.env.JWT_SECRET = 'test-only-secret-never-used-outside-isolated-tests'
process.env.GITHUB_CLIENT_ID = 'test-client'
process.env.GITHUB_CLIENT_SECRET = 'test-secret'
process.env.CLIENT_URL = 'http://localhost:5173'
process.env.NODE_ENV = 'test'
const realFetch = global.fetch
let server, base, user

before(async () => {
  await admin.query(`CREATE SCHEMA "${schemaName}"`)
  const source = fs.readFileSync(require.resolve('../src/config/initDb'), 'utf8')
  const sql = source.match(/const schema = `([\s\S]*?)`/)[1]
  await db.query(sql)
  if (fs.existsSync(require.resolve('../src/config/db').replace('db.js', 'authSchema.sql'))) {
    await db.query(fs.readFileSync(require.resolve('../src/config/db').replace('db.js', 'authSchema.sql'), 'utf8'))
  }
  const express = require('express')
  const app = express()
  app.use(express.json())
  app.use('/api/auth', require('../src/routes/auth.routes'))
  app.use('/api/auth', require('../src/routes/passwordReset.routes'))
  const { protect, restrictTo } = require('../src/middleware/auth')
  app.get('/api/auth/admin-probe', protect, restrictTo('admin'), (_req, res) => res.json({ ok: true }))
  app.use(require('../src/middleware/errorHandler').errorHandler)
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api/auth`
})
after(async () => {
  global.fetch = realFetch
  if (server) await new Promise(resolve => server.close(resolve))
  await db.end()
  await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
  await admin.end()
  await require('../src/config/db').pool.end()
})
beforeEach(async () => {
  global.fetch = realFetch
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  await db.query('TRUNCATE users CASCADE')
  const result = await db.query("INSERT INTO users(name,email,password_hash,role) VALUES('Test','test@example.com',$1,'requester') RETURNING *", [await bcrypt.hash('valid-password', 4)])
  user = result.rows[0]
})
async function call(path, body, headers = {}) {
  return realFetch(base + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
test('GitHub: authorization must be bound to the initiating browser', async () => {
  const start = await call('/github')
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  let providerCalled = false
  global.fetch = async () => { providerCalled = true; return new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 400 }) }
  await call(`/github/callback?code=fake&state=${encodeURIComponent(state)}`)
  assert.equal(providerCalled, false, 'callback without initiating browser cookie reached token exchange')
})
async function githubFlow({ profile = { id: 1234, login: 'octotest', email: 'unverified@example.com' }, emails = [{ email: 'github@example.com', verified: true, primary: true }], role = 'reviewer', failure } = {}) {
  const start = await call(`/github?role=${role}`)
  const url = new URL(start.headers.get('location'))
  const cookie = start.headers.get('set-cookie')?.split(';')[0]
  global.fetch = async (endpoint, options) => {
    if (failure === 'network') throw new Error('simulated outage')
    if (endpoint.endsWith('/access_token')) {
      const request = JSON.parse(options.body)
      assert.equal(require('node:crypto').createHash('sha256').update(request.code_verifier).digest('base64url'), url.searchParams.get('code_challenge'))
      assert.equal(request.redirect_uri, url.searchParams.get('redirect_uri'))
      return new Response(JSON.stringify(failure === 'exchange' ? { error: 'bad_verification_code' } : { access_token: 'test-provider-token' }))
    }
    return new Response(JSON.stringify(endpoint.endsWith('/emails') ? emails : profile))
  }
  return call(`/github/callback?code=test-code&state=${url.searchParams.get('state')}`, undefined, { Cookie: cookie })
}
async function exchangeGithub(response, origin = 'http://localhost:5173') {
  const cookie = response.headers.getSetCookie().find(cookie => cookie.startsWith('critiq-github-handoff=')).split(';')[0]
  return call('/github/session', {}, { Cookie: cookie, Origin: origin })
}
test('GitHub: verified email signup, selected role, callback token, and returning identity', async () => {
  const response = await githubFlow()
  assert.equal(response.status, 302)
  const url = new URL(response.headers.get('location'))
  assert.equal(url.pathname, '/auth/callback')
  assert.equal(url.search, '', 'credentials must not appear in the query string')
  assert.equal(url.hash, '')
  const exchanged = await exchangeGithub(response)
  assert.equal(exchanged.status, 200)
  const { token } = await exchanged.json()
  const me = await call('/me', undefined, { Authorization: `Bearer ${token}` })
  assert.equal(me.status, 200)
  const account = (await me.json()).user
  assert.equal(account.email, 'github@example.com')
  assert.equal(account.role, 'reviewer')
  assert.equal('password_hash' in account, false)
  const again = await githubFlow({ emails: [{ email: 'changed@example.com', verified: true }] })
  const nextToken = (await (await exchangeGithub(again)).json()).token
  assert.equal(jwt.verify(nextToken, process.env.JWT_SECRET).id, account.id)
  assert.equal((await db.query('SELECT id FROM users WHERE github_id=$1', ['1234'])).rowCount, 1)
})
test('GitHub: public email alone cannot create or link an account', async () => {
  const response = await githubFlow({ profile: { id: 1234, email: user.email }, emails: [] })
  assert.match(new URL(response.headers.get('location')).searchParams.get('error'), /verified email/)
})
test('GitHub: existing password account is not silently linked', async () => {
  const response = await githubFlow({ emails: [{ email: user.email.toUpperCase(), verified: true }] })
  assert.match(new URL(response.headers.get('location')).searchParams.get('error'), /not linked automatically/)
  assert.equal((await db.query('SELECT github_id FROM users WHERE id=$1', [user.id])).rows[0].github_id, null)
})
test('GitHub: provider exchange failure and network outage redirect to a useful error', async () => {
  for (const failure of ['exchange', 'network']) {
    const response = await githubFlow({ failure })
    assert.equal(response.status, 302)
    assert.equal(new URL(response.headers.get('location')).pathname, '/login')
    assert.ok(new URL(response.headers.get('location')).searchParams.get('error'))
  }
})
test('GitHub: cancellation, missing code, invalid state, and missing configuration', async () => {
  for (const suffix of ['error=access_denied', '', 'code=fake&state=wrong']) {
    const start = await call('/github')
    const state = new URL(start.headers.get('location')).searchParams.get('state')
    const response = await call(`/github/callback?${suffix.includes('state=') ? suffix : `state=${state}&${suffix}`}`, undefined, { Cookie: start.headers.get('set-cookie').split(';')[0] })
    assert.equal(new URL(response.headers.get('location')).pathname, '/login')
    assert.ok(new URL(response.headers.get('location')).searchParams.get('error'))
  }
  const saved = process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_ID
  try { assert.match(new URL((await call('/github')).headers.get('location')).searchParams.get('error'), /not configured/) }
  finally { process.env.GITHUB_CLIENT_ID = saved }
})
test('GitHub: handoff requires browser cookie and trusted origin and can be used only once', async () => {
  const response = await githubFlow()
  assert.equal((await exchangeGithub(response, 'https://attacker.example')).status, 403)
  assert.equal((await call('/github/session', {}, { Origin: process.env.CLIENT_URL })).status, 401)
  assert.equal((await exchangeGithub(response)).status, 200)
  assert.equal((await exchangeGithub(response)).status, 401)
})
test('GitHub: expired handoff and suspended account cannot start a session', async () => {
  const response = await githubFlow()
  await db.query("UPDATE github_handoffs SET expires_at = NOW() - INTERVAL '1 second'")
  assert.equal((await exchangeGithub(response)).status, 401)
  const another = await githubFlow()
  await db.query("UPDATE users SET role='suspended' WHERE github_id='1234'")
  assert.equal((await exchangeGithub(another)).status, 403)
})
test('validation: response explains invalid inputs without echoing passwords', async () => {
  const response = await call('/register', { name: ' ', email: 'bad', password: 'x', role: 'admin' })
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.ok(body.error, 'validation has no user-facing error message')
  assert.equal(JSON.stringify(body).includes('"value":"x"'), false)
})
test('validation: rejects overlong names and passwords before database or bcrypt', async () => {
  for (const input of [{ name: 'n'.repeat(101), password: 'valid-password' }, { name: 'Test', password: 'a'.repeat(73) }, { name: 'Test', password: 'é'.repeat(37) }]) {
    const response = await call('/register', { ...input, email: 'new@example.com', role: 'requester' })
    assert.equal(response.status, 400)
  }
})
test('validation: email comparison is case insensitive without rewriting aliases', async () => {
  await db.query('UPDATE users SET email=$1 WHERE id=$2', ['Mixed.Case+tag@gmail.com', user.id])
  const response = await call('/login', { email: ' Mixed.Case+tag@gmail.com ', password: 'valid-password' })
  assert.equal(response.status, 200)
})
test('validation: signup, duplicate account, wrong password, and concurrent duplicate signup', async () => {
  const body = { name: 'New Person', email: 'new@example.com', password: 'valid-password', role: 'reviewer' }
  const response = await call('/register', body)
  assert.equal(response.status, 201)
  const result = await response.json()
  assert.equal('password_hash' in result.user, false)
  assert.ok(await bcrypt.compare(body.password, (await db.query('SELECT password_hash FROM users WHERE email=$1', [body.email])).rows[0].password_hash))
  assert.equal((await call('/register', { ...body, email: body.email.toUpperCase() })).status, 409)
  assert.equal((await call('/login', { email: body.email, password: 'wrong-password' })).status, 401)
  const responses = await Promise.all([call('/register', { ...body, email: 'race@example.com' }), call('/register', { ...body, email: 'race@example.com' })])
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409])
})
test('sessions: suspended users cannot sign in', async () => {
  await db.query("UPDATE users SET role='suspended' WHERE id=$1", [user.id])
  const response = await call('/login', { email: user.email, password: 'valid-password' })
  assert.equal(response.status, 403)
})
test('sessions: OAuth state is not an access token', async () => {
  const token = jwt.sign({ provider: 'github' }, process.env.JWT_SECRET)
  const response = await call('/me', undefined, { Authorization: `Bearer ${token}` })
  assert.equal(response.status, 401)
})
test('sessions: existing credentials respect suspension and role changes', async () => {
  await db.query("UPDATE users SET role='admin' WHERE id=$1", [user.id])
  const { token } = await (await call('/login', { email: user.email, password: 'valid-password' })).json()
  const headers = { Authorization: `Bearer ${token}` }
  assert.equal((await call('/admin-probe', undefined, headers)).status, 200)
  await db.query("UPDATE users SET role='requester' WHERE id=$1", [user.id])
  assert.equal((await call('/admin-probe', undefined, headers)).status, 403)
  await db.query("UPDATE users SET role='suspended' WHERE id=$1", [user.id])
  assert.equal((await call('/me', undefined, headers)).status, 401)
})
test('sessions: logout revokes this session and preserves another device session', async () => {
  const login = async () => (await (await call('/login', { email: user.email, password: 'valid-password' })).json()).token
  const token = await login(), other = await login()
  const headers = { Authorization: `Bearer ${token}` }
  assert.equal((await call('/logout', {}, headers)).status, 204)
  assert.equal((await call('/me', undefined, headers)).status, 401)
  assert.equal((await call('/me', undefined, { Authorization: `Bearer ${other}` })).status, 200)
})
test('reset: anonymous callers cannot obtain an account reset credential', async () => {
  const response = await call('/forgot-password', { email: user.email })
  const body = await response.json()
  assert.equal('resetLink' in body, false, 'anonymous request returned a takeover credential')
})
test('reset: previously exposed stateless reset tokens are rejected', async () => {
  const token = jwt.sign({ userId: user.id, email: user.email, kind: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  const response = await call('/reset-password', { token, newPassword: 'new-valid-password' })
  assert.equal(response.status, 400)
})
async function requestReset(email = user.email, failure = false) {
  process.env.RESEND_API_KEY = 'test-mail-key'
  process.env.EMAIL_FROM = 'Critiq <test@example.com>'
  let token
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    const body = JSON.parse(options.body)
    const link = body.text.match(/http[^\s]+/)[0]
    token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')
    return new Response(JSON.stringify({ id: 'test-mail' }), { status: failure ? 503 : 200 })
  }
  const response = await call('/forgot-password', { email })
  return { token, response, body: await response.json() }
}
test('reset: email delivery, one-time redemption, new password, and session revocation', async () => {
  const access = (await (await call('/login', { email: user.email, password: 'valid-password' })).json()).token
  const { token, response, body } = await requestReset()
  assert.equal(response.status, 200)
  assert.equal('resetLink' in body, false)
  assert.ok(token)
  const stored = (await db.query('SELECT token_hash FROM password_reset_tokens')).rows[0].token_hash
  assert.notEqual(stored, token)
  const responses = await Promise.all([call('/reset-password', { token, newPassword: 'new-password' }), call('/reset-password', { token, newPassword: 'new-password' })])
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400])
  assert.equal((await call('/reset-password', { token, newPassword: 'another-password' })).status, 400)
  assert.equal((await call('/me', undefined, { Authorization: `Bearer ${access}` })).status, 401)
  assert.equal((await call('/login', { email: user.email, password: 'valid-password' })).status, 401)
  assert.equal((await call('/login', { email: user.email, password: 'new-password' })).status, 200)
})
test('reset: unknown accounts and delivery failures have the same public response', async () => {
  const existing = await requestReset()
  const missing = await requestReset('missing@example.com')
  assert.deepEqual(existing.body, missing.body)
  assert.equal(missing.token, undefined)
  const failed = await requestReset(user.email, true)
  assert.deepEqual(failed.body, missing.body)
  assert.equal((await db.query('SELECT * FROM password_reset_tokens')).rowCount, 0)
})
test('reset: expired, replaced, malformed and missing reset tokens are rejected', async () => {
  const first = await requestReset()
  const second = await requestReset()
  assert.equal((await call('/reset-password', { token: first.token, newPassword: 'new-password' })).status, 400)
  await db.query("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 second'")
  for (const token of [second.token, 'invalid', undefined]) assert.equal((await call('/reset-password', { token, newPassword: 'new-password' })).status, 400)
})
test('reset: missing email configuration fails clearly for all accounts', async () => {
  for (const email of [user.email, 'missing@example.com']) {
    const response = await call('/forgot-password', { email })
    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /not configured/)
  }
})
test('configuration: rejects missing or placeholder signing keys and unsafe URL settings', () => {
  const { validateAuthConfig } = require('../src/config/authConfig')
  for (const JWT_SECRET of ['', 'short', 'your-placeholder-secret-that-is-long-enough']) assert.throws(() => validateAuthConfig({ JWT_SECRET }), /JWT_SECRET/)
  const env = { JWT_SECRET: 'a'.repeat(64) }
  assert.doesNotThrow(() => validateAuthConfig(env))
  assert.throws(() => validateAuthConfig({ ...env, CLIENT_URL: 'javascript:alert(1)' }), /CLIENT_URL/)
  assert.throws(() => validateAuthConfig({ ...env, NODE_ENV: 'production', CLIENT_URL: 'http://localhost:5173' }), /HTTPS/)
})
test('sessions: expired JWT, missing session, and deleted user are rejected', async () => {
  const token = (await (await call('/login', { email: user.email, password: 'valid-password' })).json()).token
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  const expired = jwt.sign({ id: decoded.id, kind: 'access' }, process.env.JWT_SECRET, { jwtid: decoded.jti, expiresIn: -1 })
  assert.equal((await call('/me', undefined, { Authorization: `Bearer ${expired}` })).status, 401)
  const missing = jwt.sign({ id: user.id, kind: 'access' }, process.env.JWT_SECRET, { jwtid: randomUUID(), expiresIn: '1h' })
  assert.equal((await call('/me', undefined, { Authorization: `Bearer ${missing}` })).status, 401)
  await db.query('DELETE FROM users WHERE id=$1', [user.id])
  assert.equal((await call('/me', undefined, { Authorization: `Bearer ${token}` })).status, 401)
})
test('deployment: actual app permits credentialed callback exchange only for the configured frontend', async () => {
  const app = require('../src/app')
  const actual = app.listen(0, '127.0.0.1')
  await new Promise(resolve => actual.once('listening', resolve))
  try {
    const url = `http://127.0.0.1:${actual.address().port}/api/auth/github/session`
    const response = await realFetch(url, { method: 'OPTIONS', headers: { Origin: process.env.CLIENT_URL, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), process.env.CLIENT_URL)
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
    const rejected = await realFetch(url, { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(rejected.status, 403)
    assert.notEqual(rejected.headers.get('access-control-allow-origin'), 'https://attacker.example')
  } finally { await new Promise(resolve => actual.close(resolve)) }
})

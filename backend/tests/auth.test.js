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
test('GitHub: verified email signup, selected role, callback token, and returning identity', async () => {
  const response = await githubFlow()
  assert.equal(response.status, 302)
  const url = new URL(response.headers.get('location'))
  assert.equal(url.pathname, '/auth/callback')
  assert.equal(url.search, '', 'credentials must not appear in the query string')
  const token = new URLSearchParams(url.hash.slice(1)).get('token')
  const me = await call('/me', undefined, { Authorization: `Bearer ${token}` })
  assert.equal(me.status, 200)
  const account = (await me.json()).user
  assert.equal(account.email, 'github@example.com')
  assert.equal(account.role, 'reviewer')
  assert.equal('password_hash' in account, false)
  const again = await githubFlow({ emails: [{ email: 'changed@example.com', verified: true }] })
  const nextToken = new URLSearchParams(new URL(again.headers.get('location')).hash.slice(1)).get('token')
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

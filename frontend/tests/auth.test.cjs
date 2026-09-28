const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173' })
Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({ VITE_API_URL: "http://localhost:5000/api" })')
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } })
  module._compile(compiled.outputText, filename)
}
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { MemoryRouter } = require('react-router')
const { Routes, Route, useLocation } = require('react-router')
const { AuthProvider, useAuth } = require('../src/app/context/AuthContext.tsx')
const { Login } = require('../src/app/pages/Login.tsx')
const { Register } = require('../src/app/pages/Register.tsx')
let root, context, requests
const user = { id: 'user-id', name: 'Test', email: 'test@example.com', role: 'requester', review_count: 0, created_at: '' }
function Probe() { context = useAuth(); return React.createElement('span', null, context.loading ? 'Loading' : context.user?.name || 'Signed out') }
async function mount(component = React.createElement(Probe), path = '/') {
  await act(async () => {
    root.render(React.createElement(AuthProvider, null, React.createElement(MemoryRouter, { initialEntries: [path] }, component)))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  localStorage.clear(); sessionStorage.clear(); requests = []
  root = createRoot(document.getElementById('root'))
  global.fetch = async (url) => { requests.push(String(url)); return new Response(JSON.stringify({ user }), { status: 200 }) }
})
afterEach(async () => { await act(async () => root.unmount()) })
test('GitHub: frontend declares a callback route', () => {
  const source = fs.readFileSync(require.resolve('../src/app/App.tsx'), 'utf8')
  assert.match(source, /path=["']\/auth\/callback["']/)
})
test('GitHub: provider errors are visible on login', async () => {
  await mount(React.createElement(Login), '/login?error=GitHub%20login%20failed')
  assert.match(document.body.textContent, /GitHub login failed/)
})
test('GitHub: registration offers GitHub signup', async () => {
  await mount(React.createElement(Register), '/register')
  assert.match(document.body.textContent, /Sign up with GitHub/)
})
test('GitHub: callback exchanges browser-bound credential and persists session', async () => {
  const { AuthCallback } = require('../src/app/pages/AuthCallback.tsx')
  window.history.replaceState(null, '', '/auth/callback')
  global.fetch = async (url, options) => { requests.push(String(url)); assert.equal(options.credentials, 'include'); return new Response(JSON.stringify({ token: 'callback-test-token', user })) }
  await mount(React.createElement(AuthCallback), '/auth/callback')
  assert.equal(window.location.hash, '')
  assert.equal(localStorage.getItem('critiq-token'), 'callback-test-token')
  assert.equal(JSON.parse(localStorage.getItem('critiq-user')).id, user.id)
  assert.ok(requests.some(url => url.endsWith('/auth/github/session')))
})
test('GitHub: malformed callback shows recovery link', async () => {
  global.fetch = async () => new Response(JSON.stringify({ error: 'Missing sign-in cookie' }), { status: 401 })
  const { AuthCallback } = require('../src/app/pages/AuthCallback.tsx')
  await mount(React.createElement(AuthCallback), '/auth/callback')
  assert.match(document.body.textContent, /could not be completed/)
  assert.equal(document.querySelector('a').getAttribute('href'), '/login')
})
test('sessions: expired stored credentials are checked and cleared', async () => {
  localStorage.setItem('critiq-token', 'expired-test-token')
  localStorage.setItem('critiq-user', JSON.stringify(user))
  global.fetch = async () => new Response(JSON.stringify({ error: 'Token expired' }), { status: 401 })
  await mount()
  assert.equal(context.user, null)
  assert.equal(localStorage.getItem('critiq-token'), null)
})
test('validation: API client displays the field error', async () => {
  global.fetch = async () => new Response(JSON.stringify({ errors: [{ msg: 'Name is required', path: 'name' }] }), { status: 400 })
  const { api } = require('../src/api/client.ts')
  await assert.rejects(api.post('/auth/register', {}), /Name is required/)
})
test('sessions: reload uses server user even when the cached profile is corrupt', async () => {
  localStorage.setItem('critiq-token', 'valid-test-token')
  localStorage.setItem('critiq-user', '{broken-json')
  await mount()
  assert.equal(context.user.id, user.id)
  assert.ok(requests.some(url => url.endsWith('/auth/me')))
})
test('sessions: a temporary outage preserves the credential and offers retry', async () => {
  localStorage.setItem('critiq-token', 'valid-test-token')
  global.fetch = async () => { throw new Error('offline') }
  await mount()
  assert.equal(context.user, null)
  assert.match(context.sessionError, /connection/)
  assert.equal(localStorage.getItem('critiq-token'), 'valid-test-token')
  global.fetch = async () => new Response(JSON.stringify({ user }))
  await act(async () => context.retrySession())
  assert.equal(context.user.id, user.id)
})
test('sessions: logout calls the backend then clears state and local storage', async () => {
  localStorage.setItem('critiq-token', 'valid-test-token')
  await mount()
  global.fetch = async (url) => { requests.push(String(url)); return new Response(null, { status: 204 }) }
  await act(async () => assert.equal(await context.logout(), true))
  assert.equal(context.user, null)
  assert.equal(localStorage.getItem('critiq-token'), null)
  assert.ok(requests.some(url => url.endsWith('/auth/logout')))
})
test('sessions: logout failure is not falsely reported as success', async () => {
  localStorage.setItem('critiq-token', 'valid-test-token')
  await mount()
  global.fetch = async () => { throw new Error('offline') }
  await act(async () => assert.equal(await context.logout(), false))
  assert.equal(context.user.id, user.id)
})
test('sessions: protected API rejection clears the current session', async () => {
  localStorage.setItem('critiq-token', 'valid-test-token')
  await mount()
  global.fetch = async () => new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 })
  await act(async () => { await assert.rejects(require('../src/api/client.ts').api.get('/requests'), /Session expired/) })
  assert.equal(context.user, null)
})
test('sessions: signing out in another tab clears this tab', async () => {
  localStorage.setItem('critiq-token', 'valid-test-token')
  await mount()
  await act(async () => {
    localStorage.removeItem('critiq-token')
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'critiq-token', newValue: null }))
  })
  assert.equal(context.user, null)
})
function LocationProbe() { const location = useLocation(); return React.createElement('output', null, `${location.pathname}|${location.state?.from || ''}`) }
test('sessions: protected redirects preserve destination and public auth redirects signed-in users', async () => {
  const { RequireAuth, PublicAuth } = require('../src/app/components/AuthGuards.tsx')
  await mount(React.createElement(React.Fragment, null,
    React.createElement(LocationProbe),
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/review/:id', element: React.createElement(RequireAuth, null, 'Private review') }),
      React.createElement(Route, { path: '/login', element: React.createElement(PublicAuth, null, 'Login form') })
    )), '/review/123?tab=comments')
  assert.match(document.body.textContent, /\/login\|\/review\/123\?tab=comments/)
  assert.doesNotMatch(document.body.textContent, /Private review/)
})
test('sessions: return destinations cannot leave the app or loop through login', () => {
  const { safeAuthDestination } = require('../src/app/utils/authRedirect.ts')
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/auth/callback', undefined]) assert.equal(safeAuthDestination(value), '/dashboard')
  assert.equal(safeAuthDestination('/review/123?tab=comments'), '/review/123?tab=comments')
})
test('GitHub: callback survives React StrictMode effect replay', async () => {
  const { AuthCallback } = require('../src/app/pages/AuthCallback.tsx')
  window.history.replaceState(null, '', '/auth/callback')
  global.fetch = async () => new Response(JSON.stringify({ token: 'strict-test-token', user }))
  await act(async () => {
    root.render(React.createElement(React.StrictMode, null, React.createElement(AuthProvider, null, React.createElement(MemoryRouter, null, React.createElement(AuthCallback)))))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  assert.equal(localStorage.getItem('critiq-token'), 'strict-test-token')
  assert.equal(window.location.hash, '')
})
async function fill(id, value) {
  await act(async () => {
    const element = document.getElementById(id)
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function submit() {
  await act(async () => {
    document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}
test('forms: email/password login submits credentials and preserves the requested route', async () => {
  let submitted
  global.fetch = async (_url, options) => { submitted = JSON.parse(options.body); return new Response(JSON.stringify({ token: 'form-test-token', user })) }
  await mount(React.createElement(React.Fragment, null, React.createElement(LocationProbe), React.createElement(Login)), { pathname: '/login', state: { from: '/review/123' } })
  await fill('email', 'test@example.com'); await fill('password', 'valid-password'); await submit()
  assert.deepEqual(submitted, { email: 'test@example.com', password: 'valid-password' })
  assert.equal(localStorage.getItem('critiq-token'), 'form-test-token')
  assert.match(document.body.textContent, /\/review\/123/)
})
test('forms: email/password signup submits selected role and displays duplicate errors', async () => {
  let submitted
  global.fetch = async (_url, options) => { submitted = JSON.parse(options.body); return new Response(JSON.stringify({ error: 'Email already registered' }), { status: 409 }) }
  await mount(React.createElement(Register), '/register')
  await fill('name', 'New Person'); await fill('email', 'test@example.com'); await fill('password', 'valid-password')
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Review Code')).click())
  await submit()
  assert.equal(submitted.role, 'reviewer')
  assert.match(document.body.textContent, /Email already registered/)
  assert.equal(localStorage.getItem('critiq-token'), null)
})
test('reset: forgot-password displays email instructions without navigating to a reset credential', async () => {
  const { ForgotPassword } = require('../src/app/pages/ForgotPassword.tsx')
  global.fetch = async () => new Response(JSON.stringify({ message: 'Check your inbox and spam folder.' }))
  await mount(React.createElement(React.Fragment, null, React.createElement(LocationProbe), React.createElement(ForgotPassword)), '/forgot-password')
  await fill('email', 'test@example.com'); await submit()
  assert.match(document.body.textContent, /Check your inbox/)
  assert.match(document.body.textContent, /\/forgot-password/)
})
test('reset: reset form consumes fragment and submits the new password', async () => {
  const { ResetPassword } = require('../src/app/pages/ResetPassword.tsx')
  let submitted
  window.history.replaceState(null, '', '/reset-password#token=test-reset-token')
  global.fetch = async (_url, options) => { submitted = JSON.parse(options.body); return new Response(JSON.stringify({ message: 'Password updated. Sign in with your new password.' })) }
  await mount(React.createElement(ResetPassword), '/reset-password')
  assert.equal(window.location.hash, '')
  await fill('newPassword', 'new-password'); await submit()
  assert.deepEqual(submitted, { token: 'test-reset-token', newPassword: 'new-password' })
  assert.match(document.body.textContent, /Password updated/)
  assert.equal(document.querySelector('button[type=submit]').disabled, true)
})
test('GitHub: a crafted callback link cannot install a URL-supplied session', async () => {
  const { AuthCallback } = require('../src/app/pages/AuthCallback.tsx')
  window.history.replaceState(null, '', '/auth/callback#token=attacker-session')
  await mount(React.createElement(AuthCallback), '/auth/callback')
  assert.equal(localStorage.getItem('critiq-token'), null)
})
test('sessions: signed-in users leave login and non-admin users cannot render admin content', async () => {
  const { PublicAuth, RequireAdmin } = require('../src/app/components/AuthGuards.tsx')
  localStorage.setItem('critiq-token', 'valid-test-token')
  await mount(React.createElement(React.Fragment, null, React.createElement(LocationProbe),
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/login', element: React.createElement(PublicAuth, null, 'Login form') }),
      React.createElement(Route, { path: '/admin', element: React.createElement(RequireAdmin, null, 'Admin secrets') }),
      React.createElement(Route, { path: '/dashboard', element: 'Dashboard' })
    )), { pathname: '/login', state: { from: '/admin' } })
  assert.match(document.body.textContent, /\/dashboard/)
  assert.doesNotMatch(document.body.textContent, /Admin secrets|Login form/)
})
test('forms: successful signup persists the session and wrong password is shown', async () => {
  global.fetch = async () => new Response(JSON.stringify({ token: 'signup-test-token', user }), { status: 201 })
  await mount(React.createElement(Register), '/register')
  await fill('name', 'New Person'); await fill('email', 'new@example.com'); await fill('password', 'valid-password')
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Request Reviews')).click())
  await submit()
  assert.equal(localStorage.getItem('critiq-token'), 'signup-test-token')
  global.fetch = async () => new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 })
  await mount(React.createElement(Login), '/login')
  await fill('email', 'new@example.com'); await fill('password', 'wrong-password'); await submit()
  assert.match(document.body.textContent, /Invalid email or password/)
})

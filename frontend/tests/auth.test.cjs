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
test('GitHub: callback removes credential from URL, verifies user, and persists session', async () => {
  const { AuthCallback } = require('../src/app/pages/AuthCallback.tsx')
  window.history.replaceState(null, '', '/auth/callback#token=callback-test-token')
  await mount(React.createElement(AuthCallback), '/auth/callback')
  assert.equal(window.location.hash, '')
  assert.equal(localStorage.getItem('critiq-token'), 'callback-test-token')
  assert.equal(JSON.parse(localStorage.getItem('critiq-user')).id, user.id)
  assert.ok(requests.some(url => url.endsWith('/auth/me')))
})
test('GitHub: malformed callback shows recovery link', async () => {
  const { AuthCallback } = require('../src/app/pages/AuthCallback.tsx')
  await mount(React.createElement(AuthCallback), '/auth/callback')
  assert.match(document.body.textContent, /Missing GitHub/)
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

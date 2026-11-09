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
const { MemoryRouter, Routes, Route } = require('react-router')
const { AuthProvider } = require('../src/app/context/AuthContext.tsx')
const { Dashboard } = require('../src/app/pages/Dashboard.tsx')
const fixture = (id, status, language = 'TypeScript') => ({ id, title: `Review ${id}`, language, code: 'return true;', status, urgency: 'normal', author_id: 'author', author_name: 'A Developer', reviewer_id: 'reviewer', reviewer_name: 'A Reviewer', comment_count: '2', created_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-09T10:00:00Z' })
let root
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); document.documentElement.className = ''
  root = createRoot(document.getElementById('root'))
  global.fetch = async () => new Response(JSON.stringify({ requests: [fixture('one', 'pending'), fixture('two', 'in-review', 'Python'), fixture('three', 'completed')] }))
})
afterEach(async () => { await act(async () => root.unmount()) })
async function mount(component, path = '/dashboard') {
  await act(async () => {
    root.render(React.createElement(AuthProvider, null, React.createElement(MemoryRouter, { initialEntries: [path] }, component)))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}
async function clickText(text) {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text)
  assert.ok(button, `Missing button: ${text}`)
  await act(async () => button.click())
}
async function input(selector, value) {
  const element = document.querySelector(selector)
  assert.ok(element, `Missing input: ${selector}`)
  const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

test('workbench: real status counts filter the review list and combine with search', async () => {
  await mount(React.createElement(Dashboard))
  assert.equal(document.querySelectorAll('.wk-review-row').length, 3)
  const overview = document.querySelectorAll('.wk-overview button')
  assert.deepEqual([...overview].map(button => button.querySelector('strong').textContent), ['1', '1', '1'])
  await act(async () => overview[1].click())
  assert.equal(document.querySelectorAll('.wk-review-row').length, 1)
  assert.match(document.querySelector('.wk-review-row').textContent, /Review two/)
  await input('input[type=search]', 'TypeScript')
  assert.equal(document.querySelectorAll('.wk-review-row').length, 0)
  await clickText('Clear filters')
  assert.equal(document.querySelectorAll('.wk-review-row').length, 3)
})

test('workbench: loading failures offer recovery instead of a misleading empty state', async () => {
  global.fetch = async () => { throw new Error('offline') }
  await mount(React.createElement(Dashboard))
  assert.ok(document.querySelector('[role=alert]'))
  assert.equal(document.querySelector('.wk-empty'), null)
  global.fetch = async () => new Response(JSON.stringify({ requests: [fixture('recovered', 'pending')] }))
  await clickText('Try again')
  assert.match(document.querySelector('.wk-review-row').textContent, /Review recovered/)
})

test('navigation: mobile expansion supports Escape and returns focus to its trigger', async () => {
  await mount(React.createElement(Dashboard))
  const toggle = document.querySelector('[aria-controls=workspace-navigation]')
  await act(async () => toggle.click())
  assert.equal(toggle.getAttribute('aria-expanded'), 'true')
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, toggle)
  assert.equal(document.querySelector('a[aria-current=page]').getAttribute('href'), '/dashboard')
})

test('request: wizard preserves fields and publishes the selected reviewer and urgency', async () => {
  const { CreateRequest } = require('../src/app/pages/Createrequest.tsx')
  let submitted
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/users/reviewers')) return new Response(JSON.stringify({ reviewers: [{ id: 'reviewer-id', name: 'Peer Person', review_count: 4 }] }))
    if (options.method === 'POST') { submitted = JSON.parse(options.body); return new Response(JSON.stringify({ request: fixture('published', 'in-review') }), { status: 201 }) }
    throw new Error(`Unexpected request: ${url}`)
  }
  await mount(React.createElement(Routes, null,
    React.createElement(Route, { path: '/create-request', element: React.createElement(CreateRequest) }),
    React.createElement(Route, { path: '/review/:id', element: 'Published review route' })
  ), '/create-request')
  assert.equal(document.querySelector('button[type=submit]').disabled, true)
  await input('#title', 'Check empty responses')
  await input('#description', 'What if the upstream returns no body?')
  await clickText('Continue')
  await input('#code', 'const res = await fetch(url);\nreturn res.json();')
  await clickText('Back')
  assert.equal(document.querySelector('#title').value, 'Check empty responses')
  await clickText('Continue')
  assert.match(document.querySelector('#code').value, /return res.json/)
  await clickText('Continue')
  await act(async () => document.querySelector('input[value="reviewer-id"]').click())
  await act(async () => document.querySelector('input[name=urgency][value=high]').click())
  await clickText('Publish request')
  assert.deepEqual(submitted, { title: 'Check empty responses', description: 'What if the upstream returns no body?', language: 'TypeScript', code: 'const res = await fetch(url);\nreturn res.json();', urgency: 'high', reviewer_id: 'reviewer-id' })
  assert.match(document.body.textContent, /Published review route/)
})

test('review: failed note keeps the draft and retry adds it to the selected line', async () => {
  const { ReviewDetails } = require('../src/app/pages/Reviewdetails.tsx')
  let fail = true, submitted
  global.fetch = async (_url, options = {}) => {
    if (options.method === 'POST') {
      submitted = JSON.parse(options.body)
      if (fail) return new Response(JSON.stringify({ error: 'Please try again' }), { status: 503 })
      return new Response(JSON.stringify({ comment: { id: 'note-id', request_id: 'review-id', author_name: 'A Peer', line_number: 2, text: submitted.text, created_at: '2026-11-09T10:00:00Z' } }), { status: 201 })
    }
    return new Response(JSON.stringify({ request: { ...fixture('review-id', 'in-review'), code: 'const res = await fetch(url);\nreturn res.json();' }, comments: [] }))
  }
  await mount(React.createElement(Routes, null, React.createElement(Route, { path: '/review/:id', element: React.createElement(ReviewDetails) })), '/review/review-id')
  await act(async () => document.querySelector('[aria-label="Add note on line 2"]').click())
  assert.equal(document.activeElement.id, 'review-note')
  await input('#review-note', 'Should we check the status first?')
  await clickText('Close draft')
  await clickText('You have an unsent draft. Keep writing')
  assert.match(document.querySelector('.wk-note-composer label').textContent, /line 2/)
  assert.equal(document.querySelector('#review-note').value, 'Should we check the status first?')
  await clickText('Add note')
  assert.match(document.querySelector('[role=alert]').textContent, /Please try again/)
  assert.equal(document.querySelector('#review-note').value, 'Should we check the status first?')
  fail = false
  await clickText('Add note')
  assert.deepEqual(submitted, { request_id: 'review-id', line_number: 2, text: 'Should we check the status first?' })
  assert.match(document.querySelector('.wk-note-feed').textContent, /Should we check the status first/)
  assert.equal(document.querySelector('#review-note'), null)
})

test('review: assigned reviewer can mark complete and sees the updated status', async () => {
  const { ReviewDetails } = require('../src/app/pages/Reviewdetails.tsx')
  localStorage.setItem('critiq-token', 'test-token')
  let patched
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/me')) return new Response(JSON.stringify({ user: { id: 'reviewer', name: 'Peer Person', role: 'reviewer' } }))
    if (options.method === 'PATCH') { patched = JSON.parse(options.body); return new Response(JSON.stringify({ request: { ...fixture('review-id', 'completed'), reviewer_name: undefined } })) }
    return new Response(JSON.stringify({ request: fixture('review-id', 'in-review'), comments: [] }))
  }
  await mount(React.createElement(Routes, null, React.createElement(Route, { path: '/review/:id', element: React.createElement(ReviewDetails) })), '/review/review-id')
  await clickText('Mark complete')
  assert.deepEqual(patched, { status: 'completed' })
  assert.match(document.body.textContent, /Review complete/)
  assert.equal([...document.querySelectorAll('button')].some(button => button.textContent === 'Mark complete'), false)
})

test('code: clipboard rejection provides instructions instead of claiming success', async () => {
  const { CodeBlock } = require('../src/app/components/shared/CodeBlock.tsx')
  Object.defineProperty(global.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied') } } })
  await mount(React.createElement(CodeBlock, { code: 'return true;' }))
  await clickText('Copy code')
  assert.match(document.querySelector('[role=status]').textContent, /Copy failed/)
})

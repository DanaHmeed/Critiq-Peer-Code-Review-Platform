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

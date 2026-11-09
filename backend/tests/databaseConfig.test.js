const { test } = require('node:test')
const assert = require('node:assert/strict')
const { databaseConfig, describeDatabaseError } = require('../src/config/databaseConfig')

test('database: local development retains DB_* configuration', () => {
  const config = databaseConfig({ DB_USER: 'local-user', DB_PASSWORD: 'test-only' })
  assert.equal(config.host, 'localhost')
  assert.equal(config.port, 5432)
  assert.equal(config.database, 'critiq_db')
  assert.equal(config.user, 'local-user')
  assert.equal(config.password, 'test-only')
})

test('database: hosted URL overrides local settings without disabling TLS verification', () => {
  const url = 'postgresql://test-user:test-only@db.example.com/reviews?sslmode=verify-full'
  const config = databaseConfig({ DATABASE_URL: url, DB_HOST: 'localhost', NODE_ENV: 'production' })
  assert.equal(config.connectionString, url)
  assert.equal(config.host, undefined)
  assert.equal(config.ssl, undefined)
})

test('database: deployed app reports missing configuration instead of defaulting to localhost', () => {
  assert.throws(() => databaseConfig({ NODE_ENV: 'production' }), /Set DATABASE_URL/)
  assert.throws(() => databaseConfig({ RENDER: 'true' }), /Set DATABASE_URL/)
  assert.equal(databaseConfig({ NODE_ENV: 'production', DB_HOST: 'private-db' }).host, 'private-db')
})

test('database: empty aggregate error explains connection refusal without leaking credentials', () => {
  const error = new AggregateError([{ code: 'ECONNREFUSED' }, { code: 'ECONNREFUSED' }], '')
  error.message = 'postgresql://user:secret@localhost/db'
  const message = describeDatabaseError(error)
  assert.match(message, /ECONNREFUSED/)
  assert.match(message, /host and port/)
  assert.doesNotMatch(message, /secret|postgresql:\/\//)
  assert.match(describeDatabaseError({ code: '28P01' }), /authentication failed/)
})

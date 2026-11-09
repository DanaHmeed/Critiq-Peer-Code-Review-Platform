const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { generateJwtSecret } = require('../scripts/generateJwtSecret')

test('secret generator changes only JWT_SECRET and never writes to the real env in tests', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'critiq-secret-test-'))
  const file = path.join(directory, '.env')
  try {
    fs.writeFileSync(file, 'DB_PASSWORD=test-only\nJWT_SECRET=placeholder\nPORT=5000\n')
    generateJwtSecret(file)
    const result = fs.readFileSync(file, 'utf8')
    assert.match(result, /^JWT_SECRET=[a-f0-9]{64}$/m)
    assert.match(result, /^DB_PASSWORD=test-only$/m)
    assert.match(result, /^PORT=5000$/m)
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory) }
})

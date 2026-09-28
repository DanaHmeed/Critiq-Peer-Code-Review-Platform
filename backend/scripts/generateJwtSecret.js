const fs = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

function generateJwtSecret(file) {
  const content = fs.readFileSync(file, 'utf8')
  const line = `JWT_SECRET=${randomBytes(32).toString('hex')}`
  const pattern = /^[\t ]*(?:export\s+)?JWT_SECRET\s*=.*$/gm
  const updated = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`
  fs.writeFileSync(file, updated, { mode: 0o600 })
}
if (require.main === module) {
  generateJwtSecret(path.join(__dirname, '..', '.env'))
  console.log('Updated JWT_SECRET in backend/.env without displaying it. Restart the API; existing sessions will need to sign in again.')
}
module.exports = { generateJwtSecret }

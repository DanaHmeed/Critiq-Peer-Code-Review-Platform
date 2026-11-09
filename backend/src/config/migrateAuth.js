require('dotenv').config()
const fs = require('node:fs')
const path = require('node:path')
const { pool } = require('./db')
async function migrateAuth() {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'authSchema.sql'), 'utf8'))
    console.log('Authentication schema ready.')
  } catch (error) {
    console.error('Authentication migration failed:', error.code || error.name)
    process.exitCode = 1
  } finally { await pool.end() }
}
migrateAuth()

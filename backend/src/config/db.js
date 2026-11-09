// backend/src/config/db.js
const { Pool } = require('pg')
const { databaseConfig, describeDatabaseError } = require('./databaseConfig')

const pool = new Pool(databaseConfig())

// Convenience wrapper — returns rows directly
const query = (text, params) => pool.query(text, params)

// Called on startup to verify the DB is reachable
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS now')
    console.log(`✅  DB connected — server time: ${res.rows[0].now}`)
  } catch (err) {
    throw new Error(`DB connection failed: ${describeDatabaseError(err)}`)
  }
}

module.exports = { pool, query, testConnection }

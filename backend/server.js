require('dotenv').config()

const { testConnection } = require('./src/config/db')
const { validateAuthConfig } = require('./src/config/authConfig')

const PORT = process.env.PORT || 5000

async function start() {
  validateAuthConfig()
  const app = require('./src/app')
  // Verify DB connection before accepting traffic
  await testConnection()

  app.listen(PORT, () => {
    console.log(`\n🚀  Critiq API running on http://localhost:${PORT}`)
    console.log(`   ENV  : ${process.env.NODE_ENV}`)
    console.log(`   DB   : ${process.env.DATABASE_URL ? 'configured with DATABASE_URL' : 'configured with DB_* settings'}\n`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})

function databaseConfig(env = process.env) {
  const shared = {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  }

  // Managed hosts supply a complete URL. Its SSL parameters are handled by pg.
  if (env.DATABASE_URL?.trim()) {
    return { ...shared, connectionString: env.DATABASE_URL.trim() }
  }

  if ((env.NODE_ENV === 'production' || env.RENDER === 'true') && !env.DB_HOST) {
    throw new Error('Set DATABASE_URL to your hosted PostgreSQL connection URL, or configure DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD. The local development database is not reachable from Render.')
  }

  return {
    ...shared,
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 5432,
    database: env.DB_NAME || 'critiq_db',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
  }
}

function describeDatabaseError(error) {
  // Node can return an AggregateError with an empty message for localhost.
  // Report codes, never the connection URL, password or raw driver error.
  const codes = [...new Set([error?.code, ...(error?.errors || []).map(item => item.code)]
    .filter(code => typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)))]
  const hints = {
    ECONNREFUSED: 'No PostgreSQL server accepted the connection. Check the database host and port; localhost is not your laptop when deployed.',
    ETIMEDOUT: 'The database connection timed out. Check network access, database availability and the host.',
    ENOTFOUND: 'The database hostname could not be resolved. Check the connection URL and database region.',
    EAI_AGAIN: 'Database hostname lookup temporarily failed. Check DNS and retry.',
    '28P01': 'Database authentication failed. Check the database username and password.',
    '3D000': 'The configured database does not exist. Check the database name.',
    '28000': 'PostgreSQL rejected access. Check the database access rules and required TLS settings.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'Database TLS certificate verification failed. Configure the trusted CA required by your database provider.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'The database TLS certificate does not match the configured hostname.',
  }
  const hint = codes.map(code => hints[code]).find(Boolean) || 'Check the PostgreSQL connection settings, database availability and provider TLS requirements.'
  return `${codes.length ? codes.join(', ') : 'Database connection error'}: ${hint}`
}

module.exports = { databaseConfig, describeDatabaseError }


function errorHandler(err, req, res, _next) {
  // Log in dev, suppress in prod
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${req.method}] ${req.path}`, err.code || err.name)
  }

  // PostgreSQL unique violation (e.g. duplicate email)
  if (err.code === '23505') {
    return res.status(409).json({ error: ['users_email_key', 'users_email_lower_unique'].includes(err.constraint) ? 'Email already registered' : 'A record with that value already exists' })
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' })
  }

  // JWT errors bubbled up manually
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const status  = err.statusCode || err.status || 500
  const message = status >= 500 ? 'Something went wrong. Please try again.' : err.message || 'Request failed'

  res.status(status).json({ error: message })
}

/**
 * Async wrapper — eliminates try/catch in every controller
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

module.exports = { errorHandler, asyncHandler }

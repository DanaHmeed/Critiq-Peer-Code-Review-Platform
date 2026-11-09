const jwt = require('jsonwebtoken')
const { query } = require('../config/db')

async function protect(req, res, next) {
  const match = /^Bearer ([^ ]+)$/.exec(req.headers.authorization || '')
  if (!match) return res.status(401).json({ error: 'No token provided' })
  let decoded
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] })
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (decoded.kind !== 'access' || !uuid.test(decoded.id) || !uuid.test(decoded.jti)) throw new Error('Invalid access token')
  } catch (error) {
    return res.status(401).json({ error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' })
  }
  try {
    const result = await query(`SELECT u.id, u.email, u.role FROM auth_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.user_id = $2 AND s.expires_at > NOW()`, [decoded.jti, decoded.id])
    const user = result.rows[0]
    if (!user || user.role === 'suspended') return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' })
    req.user = user
    req.sessionId = decoded.jti
    next()
  } catch (error) { next(error) }
}
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'You do not have permission for this action' })
    next()
  }
}
module.exports = { protect, restrictTo }

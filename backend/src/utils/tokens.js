const jwt = require('jsonwebtoken')
const { randomUUID } = require('node:crypto')
const { query } = require('../config/db')
async function signToken(user) {
  const id = randomUUID()
  const token = jwt.sign({ id: user.id, kind: 'access' }, process.env.JWT_SECRET, { jwtid: id, expiresIn: process.env.JWT_EXPIRES_IN || '7d', algorithm: 'HS256' })
  const { exp } = jwt.decode(token)
  await query('DELETE FROM auth_sessions WHERE user_id = $1 AND expires_at <= NOW()', [user.id])
  await query('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [id, user.id, new Date(exp * 1000)])
  return token
}
module.exports = { signToken }

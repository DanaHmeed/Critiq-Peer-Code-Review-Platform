function validateAuthConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /^(your|replace|changeme|placeholder)/i.test(env.JWT_SECRET)) {
    throw new Error('Set JWT_SECRET to a randomly generated secret of at least 32 characters before starting the API.')
  }
  try {
    const jwt = require('jsonwebtoken')
    const token = jwt.sign({}, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN || '7d' })
    if (jwt.decode(token).exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired')
  } catch { throw new Error('JWT_EXPIRES_IN must be a positive duration such as 7d or 1h.') }
  for (const name of ['CLIENT_URL', 'API_PUBLIC_URL', 'GITHUB_CALLBACK_URL']) {
    if (!env[name]) continue
    let url
    try { url = new URL(env[name]) } catch { throw new Error(`${name} must be an absolute HTTP(S) URL.`) }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`${name} must be an HTTP(S) URL without credentials, query, or fragment.`)
    if (name !== 'GITHUB_CALLBACK_URL' && url.pathname !== '/') throw new Error(`${name} must contain only an origin, without a path.`)
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`)
  }
  if (env.NODE_ENV === 'production' && (!env.CLIENT_URL || !env.API_PUBLIC_URL)) throw new Error('Set CLIENT_URL and API_PUBLIC_URL to your HTTPS origins in production.')
  const minutes = Number(env.RESET_TOKEN_TTL_MINUTES || 60)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw new Error('RESET_TOKEN_TTL_MINUTES must be an integer from 1 to 60.')
}
module.exports = { validateAuthConfig }

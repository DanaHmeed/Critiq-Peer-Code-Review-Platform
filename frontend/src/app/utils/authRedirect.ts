export function safeAuthDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard'
  const url = new URL(value, 'http://local')
  if (url.origin !== 'http://local' || ['/login', '/register', '/auth/callback'].includes(url.pathname)) return '/dashboard'
  return url.pathname + url.search + url.hash
}

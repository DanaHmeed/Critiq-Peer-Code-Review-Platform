// frontend/src/api/client.ts

export const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')

function getToken(): string | null {
  return localStorage.getItem('critiq-token')
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options

  // Build URL with optional query params
  const url = new URL(`${BASE_URL}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })
  }

  const token = getToken()

  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }).catch(() => { throw new ApiError('Could not reach the server. Check your connection and try again.', 0) })

  // Handle no-content responses
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const message = data?.fields?.[0]?.message || data?.errors?.[0]?.msg || data?.error || data?.message || (res.status >= 500 ? 'The server is unavailable. Please try again.' : `Request failed (${res.status})`)
    const authorization = new Headers(headers).get('Authorization') || (token ? `Bearer ${token}` : '')
    if (res.status === 401 && authorization && authorization === `Bearer ${localStorage.getItem('critiq-token')}` && !['/auth/login', '/auth/register'].includes(endpoint)) {
      window.dispatchEvent(new Event('critiq:session-invalid'))
    }
    throw new ApiError(message, res.status)
  }

  return data as T
}

// ── Convenience methods ───────────────────────────────────────────
export const api = {
  get: <T>(endpoint: string, params?: RequestOptions['params'], headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'GET', params, headers }),

  post: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
}

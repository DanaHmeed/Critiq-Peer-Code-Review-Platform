import { api, BASE_URL } from './client'
import type { User } from './types'

interface AuthResponse {
  token: string
  user: User
}

export const authApi = {
  githubUrl: (role = 'requester') => `${BASE_URL}/auth/github?role=${encodeURIComponent(role)}`,
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', body),

  register: (body: { name: string; email: string; password: string; role: string }) =>
    api.post<AuthResponse>('/auth/register', body),

  me: () => api.get<{ user: User }>('/auth/me'),
  logout: () => api.post<void>('/auth/logout', {}),
  meWithToken: (token: string) => api.get<{ user: User }>('/auth/me', undefined, { Authorization: `Bearer ${token}` }),
}

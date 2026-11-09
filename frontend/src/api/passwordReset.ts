import { api } from './client'

export const passwordResetApi = {
  forgotPassword: (body: { email: string }) =>
    api.post<{ message: string }>(
      '/auth/forgot-password',
      body,
    ),

  resetPassword: (body: { token: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/reset-password', body),
}


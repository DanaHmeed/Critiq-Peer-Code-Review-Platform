function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}
async function sendResetEmail(email, link) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Reset your Critiq password', text: `Use this one-time link to reset your password:\n\n${link}\n\nIf you did not request this, you can ignore this email.` }),
  })
  if (!response.ok) throw new Error('Email delivery failed')
}
module.exports = { emailConfigured, sendResetEmail }

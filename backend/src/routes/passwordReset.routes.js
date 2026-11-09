const express = require('express')
const { body } = require('express-validator')
const { forgotPassword, resetPassword } = require('../controllers/passwordReset.controller')
const { emailRule, passwordRule } = require('../middleware/authValidation')
const { validate } = require('../middleware/validate')

const router = express.Router()

router.post(
  '/forgot-password',
  [
    emailRule(),
  ],
  validate, forgotPassword
)

router.post(
  '/reset-password',
  [
    body('token').isString().bail().matches(/^[a-f0-9]{64}$/).withMessage('Invalid or expired reset link. Request a new link.'),
    passwordRule('newPassword'),
  ],
  validate, resetPassword
)

module.exports = router


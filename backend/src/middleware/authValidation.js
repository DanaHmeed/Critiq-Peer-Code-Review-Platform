const { body } = require('express-validator')
const emailRule = () => body('email').isString().withMessage('Valid email required').bail().trim().isEmail().withMessage('Valid email required').bail().isLength({ max: 255 }).withMessage('Email is too long').customSanitizer((value, { req }) => {
  req.originalEmail = value.toLowerCase()
  return value
}).normalizeEmail()
const passwordRule = (field = 'password', min = 6) => body(field).isString().withMessage('Password is required').bail().isLength({ min }).withMessage(`Password must be at least ${min} characters`).bail().custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must be at most 72 UTF-8 bytes')
module.exports = { emailRule, passwordRule }

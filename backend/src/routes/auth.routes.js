// backend/src/routes/auth.routes.js
const express = require('express')
const { body } = require('express-validator')
const { register, login, getMe, logout } = require('../controllers/auth.controller')
const { githubLogin, githubCallback, githubSession } = require('../controllers/github.controller')
const { protect } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { emailRule, passwordRule } = require('../middleware/authValidation')

const router = express.Router()
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

router.post(
  '/register',
  [
    body('name').isString().withMessage('Name is required').bail().trim().notEmpty().withMessage('Name is required').bail().isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    emailRule(),
    passwordRule(),
    body('role').isIn(['requester', 'reviewer']).withMessage('Role must be requester or reviewer'),
  ],
  validate, register
)

router.post(
  '/login',
  [
    emailRule(),
    passwordRule('password', 1),
  ],
  validate, login
)

router.get('/me', protect, getMe)
router.post('/logout', protect, logout)

const { asyncHandler } = require('../middleware/errorHandler')
router.get('/github', asyncHandler(githubLogin))
router.get('/github/callback', asyncHandler(githubCallback))
router.post('/github/session', githubSession)

module.exports = router

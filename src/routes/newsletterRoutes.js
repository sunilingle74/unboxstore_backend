const router = require('express').Router()
const { subscribe } = require('../controllers/newsletterController')

router.post('/', subscribe)

module.exports = router

const router = require('express').Router()
const { checkServiceability } = require('../controllers/shipmentController')

router.get('/serviceability', checkServiceability)

module.exports = router

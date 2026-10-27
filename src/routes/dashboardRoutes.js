const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const { getDashboard } = require('../controllers/dashboardController')

router.get('/', protect, authorize('admin', 'staff'), getDashboard)

module.exports = router

const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateMe,
  updateMyPassword,
  addAddress,
  updateAddress,
  deleteAddress,
} = require('../controllers/userController')

router.patch('/me', protect, updateMe)
router.patch('/me/password', protect, updateMyPassword)
router.post('/me/addresses', protect, addAddress)
router.patch('/me/addresses/:addressId', protect, updateAddress)
router.delete('/me/addresses/:addressId', protect, deleteAddress)

router.get('/', protect, authorize('admin', 'staff'), getUsers)
router.get('/:id', protect, authorize('admin', 'staff'), getUser)
router.patch('/:id', protect, authorize('admin'), updateUser)
router.delete('/:id', protect, authorize('admin'), deleteUser)

module.exports = router

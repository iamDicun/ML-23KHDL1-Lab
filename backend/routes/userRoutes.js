import express from 'express'
import { UserController } from '../controllers/userController.js'

const router = express.Router()

// User routes
router.get('/', UserController.getUsers)
router.get('/:id', UserController.getUser)
router.post('/', UserController.createUser)
router.put('/:id', UserController.updateUser)
router.delete('/:id', UserController.deleteUser)

export default router

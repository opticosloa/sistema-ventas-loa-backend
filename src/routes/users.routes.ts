import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = UsersController.getInstance();

router.post('/login', controller.loginUser.bind(controller));
router.post('/logout', authMiddleware, controller.logoutUser.bind(controller));
router.get('/validate-token', controller.validateToken.bind(controller));

router.get('/admins', controller.getAdmins.bind(controller));
router.post('/verify-supervisor', controller.verifySupervisor.bind(controller));

router.post("/", authMiddleware, controller.createUser.bind(controller));
router.get('/', controller.getUsers.bind(controller));

router.post('/change-password', authMiddleware, controller.changePassword.bind(controller));
router.post('/rol', authMiddleware, controller.handlerRol.bind(controller));
router.put('/:id/pin', authMiddleware, controller.updatePin.bind(controller));
router.get('/profile/:email', controller.getUserByEmail.bind(controller));
router.put('/profile/:email', controller.updateProfile.bind(controller));
router.get('/:id', controller.getUserById.bind(controller));
router.put('/:id', authMiddleware, controller.updateUser.bind(controller));
router.delete('/:id', authMiddleware, controller.deleteUser.bind(controller));
router.put('/:id/max-descuento', authMiddleware, controller.updateMaxDescuento.bind(controller));


router.post('/move', authMiddleware, controller.moveUser.bind(controller));
router.post('/schedule', authMiddleware, controller.setSchedule.bind(controller));
router.delete('/:usuario_id/schedule/:dia', authMiddleware, controller.deleteScheduleRule.bind(controller));
router.get('/:id/schedule', authMiddleware, controller.getSchedule.bind(controller));

export default router;

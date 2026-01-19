import { Router } from "express";
import { UsersController } from "../controllers/users.controller";

const router = Router();
const controller = UsersController.getInstance();

router.post('/login', controller.loginUser.bind(controller));
router.post('/logout', controller.logoutUser.bind(controller));
router.get('/validate-token', controller.validateToken.bind(controller));

router.get('/admins', controller.getAdmins.bind(controller));
router.post('/verify-supervisor', controller.verifySupervisor.bind(controller));

router.post("/", controller.createUser.bind(controller));
router.get('/', controller.getUsers.bind(controller));

router.post('/change-password', controller.changePassword.bind(controller));
router.post('/rol', controller.handlerRol.bind(controller));
router.put('/:id/pin', controller.updatePin.bind(controller));
router.get('/profile/:email', controller.getUserByEmail.bind(controller));
router.put('/profile/:email', controller.updateProfile.bind(controller));
router.get('/:id', controller.getUserById.bind(controller));
router.put('/:id', controller.updateUser.bind(controller));
router.delete('/:id', controller.deleteUser.bind(controller));
router.put('/:id/max-descuento', controller.updateMaxDescuento.bind(controller));




export default router;

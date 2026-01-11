import { Router } from 'express';
import { CashierController } from '../controllers/cashier.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = CashierController.getInstance();

// Protegemos todas las rutas con authMiddleware para tener acceso a req.user
router.use(authMiddleware);

router.get('/stats', controller.getCashierStats.bind(controller));
router.post('/close', controller.closeCashier.bind(controller));

export default router;

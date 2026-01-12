import { Router } from 'express';
import { CurrencyController } from '../controllers/currencyController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = CurrencyController.getInstance();

// Protegemos las rutas para que solo usuarios autenticados puedan ver/editar
router.use(authMiddleware);

router.get('/rate', controller.getDolarRate.bind(controller));
router.post('/rate', controller.updateDolarRate.bind(controller));

export default router;

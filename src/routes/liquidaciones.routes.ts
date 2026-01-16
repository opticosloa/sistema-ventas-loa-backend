import { Router } from 'express';
import { LiquidacionesController } from '../controllers/liquidaciones.controller';

const router = Router();

router.get('/pending', LiquidacionesController.getInstance().getPendingItems);
router.get('/:id', LiquidacionesController.getInstance().getById);
router.get('/', LiquidacionesController.getInstance().getAll);
router.post('/', LiquidacionesController.getInstance().save);
router.put('/:id/status', LiquidacionesController.getInstance().updateStatus);

export default router;

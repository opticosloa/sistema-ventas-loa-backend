import { Router } from 'express';
import { CashController } from '../controllers/cash.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = CashController.getInstance();

router.use(authMiddleware);

router.get('/summary', controller.getClosingSummary.bind(controller));
router.post('/close', controller.performClosing.bind(controller));

export default router;

import { Router } from 'express';
import { ObrasSocialesController } from '../controllers/obras_sociales.controller';

const router = Router();

router.get('/', ObrasSocialesController.getInstance().getAll);
router.post('/', ObrasSocialesController.getInstance().upsert);

export default router;

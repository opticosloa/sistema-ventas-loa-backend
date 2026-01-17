import { Router } from 'express';
import { ObrasSocialesController } from '../controllers/obras_sociales.controller';

const router = Router();

router.get('/', ObrasSocialesController.getInstance().getAll);
router.get('/search/:q', ObrasSocialesController.getInstance().searchObrasSociales);
router.get('/:id', ObrasSocialesController.getInstance().getObraSocialById);
router.post('/', ObrasSocialesController.getInstance().upsert);
router.delete('/:id', ObrasSocialesController.getInstance().deleteObraSocial);

export default router;

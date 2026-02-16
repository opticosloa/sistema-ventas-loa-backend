import { Router } from 'express';
import { WorkshopsController } from '../controllers/workshops.controller';

const router = Router();
const controller = WorkshopsController.getInstance();

router.post('/', controller.upsert.bind(controller));
router.get('/', controller.getActive.bind(controller));
router.get('/admin', controller.getAll.bind(controller));

export default router;

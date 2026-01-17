import { Router } from "express";
import { ProvidersController } from "../controllers/providers.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = ProvidersController.getInstance();

router.get('/', authMiddleware, controller.getProviders.bind(controller));
router.get('/search', authMiddleware, controller.searchProviders.bind(controller));
router.get('/:id', authMiddleware, controller.getProviderById.bind(controller));
router.post('/', authMiddleware, controller.createProvider.bind(controller));
router.put('/:id', authMiddleware, controller.updateProvider.bind(controller));
router.delete('/:id', authMiddleware, controller.deleteProvider.bind(controller));

export default router;

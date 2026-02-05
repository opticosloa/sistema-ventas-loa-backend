import { Router } from "express";
import { MultifocalesController } from "../controllers/multifocales.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = MultifocalesController.getInstance();

router.get('/search', authMiddleware, controller.search.bind(controller));
router.post('/upsert', authMiddleware, controller.upsert.bind(controller));
router.post('/stock/adjustment', authMiddleware, controller.adjustStock.bind(controller));
router.get('/search/stock', authMiddleware, controller.searchStock.bind(controller));

// Marcas
router.get('/brands', authMiddleware, controller.getBrands.bind(controller));
router.post('/brands', authMiddleware, controller.createBrand.bind(controller));
router.put('/brands/:id', authMiddleware, controller.updateBrand.bind(controller));

// Modelos
router.get('/models', authMiddleware, controller.getModels.bind(controller));
router.post('/models', authMiddleware, controller.createModel.bind(controller));
router.put('/models/:id', authMiddleware, controller.updateModel.bind(controller));

export default router;

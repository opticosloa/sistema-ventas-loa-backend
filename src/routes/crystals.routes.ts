import { Router } from "express";
import { CrystalsController } from "../controllers/crystals.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = CrystalsController.getInstance();

// En tu archivo de rutas (ej: stock.routes.ts o products.routes.ts)
router.post('/cristales/batch', controller.createBatchCristales.bind(controller));
router.get('/check-stock', authMiddleware, controller.checkStock.bind(controller));
router.get('/search-range', authMiddleware, controller.searchRange.bind(controller));
router.get('/price-check', controller.getPriceForSale.bind(controller));

export default router;

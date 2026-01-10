import { Router } from "express";
import { CrystalsController } from "../controllers/crystals.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = CrystalsController.getInstance();

router.get('/check-stock', authMiddleware, controller.checkStock.bind(controller));
router.get('/search-range', authMiddleware, controller.searchRange.bind(controller));
router.post('/', authMiddleware, controller.createCrystal.bind(controller));

export default router;

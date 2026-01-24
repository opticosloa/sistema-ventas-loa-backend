import { Router } from "express";
import { MultifocalesController } from "../controllers/multifocales.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = MultifocalesController.getInstance();

router.get('/search', authMiddleware, controller.search.bind(controller));
router.post('/upsert', authMiddleware, controller.upsert.bind(controller));

export default router;

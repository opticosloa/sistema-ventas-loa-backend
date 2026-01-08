import { Router } from "express";
import { getStockAlerts } from "../controllers";
import { authMiddleware, isAdmin } from "../middlewares";


const router = Router();

router.get('/alerts/stock', authMiddleware, isAdmin, getStockAlerts);

export default router;

import { Router } from "express";
import { CrystalsController } from "../controllers/crystals.controller";
import { CrystalSettingsController } from "../controllers/crystalSettings.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = CrystalsController.getInstance();
const settingsController = CrystalSettingsController.getInstance();

// Batch Operations
router.post('/batch', controller.createBatchCristales.bind(controller));
router.get('/check-stock', authMiddleware, controller.checkStock.bind(controller));
router.get('/search-range', authMiddleware, controller.searchRange.bind(controller));
router.get('/price-check', controller.getPriceForSale.bind(controller));
// Settings (Materials & Treatments)
router.get('/materials', settingsController.getMaterials.bind(settingsController));
router.post('/materials', settingsController.createMaterial.bind(settingsController));
router.get('/treatments', settingsController.getTreatments.bind(settingsController));
router.post('/treatments', settingsController.createTreatment.bind(settingsController));

export default router;

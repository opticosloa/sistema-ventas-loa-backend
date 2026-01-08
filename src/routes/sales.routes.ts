import { Router } from "express";
import { SalesController } from "../controllers/sales.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = SalesController.getInstance();

router.post('/', authMiddleware, controller.createSale.bind(controller));
router.get('/', authMiddleware, controller.getSales.bind(controller));
router.get('/by-client-dni/:dni', controller.getPendingSalesByDni.bind(controller));

router.get('/:id', authMiddleware, controller.getSaleById.bind(controller));
router.put('/:id', authMiddleware, controller.updateSale.bind(controller));
router.delete('/:id', authMiddleware, controller.deleteSale.bind(controller));

router.get('/:id/estado-pago', authMiddleware, controller.getEstadoPago.bind(controller));
router.post('/:id/intentar-cierre', authMiddleware, controller.intentarCierre.bind(controller));
router.post('/:id/entregar', authMiddleware, controller.entregarVenta.bind(controller));
router.put('/:id/cancel', controller.cancelSale.bind(controller));

export default router;

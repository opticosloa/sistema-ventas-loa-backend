import { Router } from "express";
import { SalesController } from "../controllers/sales.controller";
import { SalesPdfController } from "../controllers/sales.pdf.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = SalesController.getInstance();
const pdfController = SalesPdfController.getInstance();

router.post('/', authMiddleware, controller.createSale.bind(controller));
router.get('/', authMiddleware, controller.getSales.bind(controller));
router.get('/by-client-dni/:dni', controller.getPendingSalesByDni.bind(controller));

router.get('/:id', authMiddleware, controller.getSaleById.bind(controller));
router.get('/:id/laboratory-order', pdfController.generateLaboratoryOrder.bind(pdfController)); // New Route
router.put('/:id', authMiddleware, controller.updateSale.bind(controller));
router.delete('/:id', authMiddleware, controller.deleteSale.bind(controller));

router.get('/:id/estado-pago', authMiddleware, controller.getEstadoPago.bind(controller));
router.post('/:id/intentar-cierre', authMiddleware, controller.intentarCierre.bind(controller));
router.post('/:id/entregar', authMiddleware, controller.entregarVenta.bind(controller));
router.put('/:id/cancel', controller.cancelSale.bind(controller));
router.put('/:id/observation', authMiddleware, controller.updateObservation.bind(controller));
router.put('/:id/budget', authMiddleware, controller.markAsBudget.bind(controller));

router.post('/cover-insurance', authMiddleware, controller.coverInsurance.bind(controller));
router.post('/returns', authMiddleware, controller.createReturn.bind(controller));

export default router;

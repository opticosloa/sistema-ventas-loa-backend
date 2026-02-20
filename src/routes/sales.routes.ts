import { Router } from "express";
import { SalesController } from "../controllers/sales.controller";
import { SalesPdfController } from "../controllers/sales.pdf.controller";
import { CreditNotePdfController } from "../controllers/credit-note.pdf.controller";
import { BudgetController } from "../controllers/budget.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = SalesController.getInstance();
const pdfController = SalesPdfController.getInstance();
const creditNotePdfController = CreditNotePdfController.getInstance();
const budgetController = BudgetController.getInstance();

router.post('/', authMiddleware, controller.createSale.bind(controller));
router.get('/', authMiddleware, controller.getSales.bind(controller));
router.get('/by-client-dni/:dni', controller.getPendingSalesByDni.bind(controller));
router.get('/search', authMiddleware, controller.searchSales.bind(controller));

router.post('/cover-insurance', authMiddleware, controller.coverInsurance.bind(controller));
router.post('/returns', authMiddleware, controller.createReturn.bind(controller));

router.get('/:id', authMiddleware, controller.getSaleById.bind(controller));
router.put('/:id', authMiddleware, controller.updateSale.bind(controller));
router.delete('/:id', authMiddleware, controller.deleteSale.bind(controller));

router.get('/:id/laboratory-order', pdfController.generateLaboratoryOrder.bind(pdfController));
router.get('/:id/credit-note', creditNotePdfController.generateCreditNote.bind(creditNotePdfController));

router.get('/:id/estado-pago', authMiddleware, controller.getEstadoPago.bind(controller));
router.post('/:id/intentar-cierre', authMiddleware, controller.intentarCierre.bind(controller));
router.post('/:id/entregar', authMiddleware, controller.entregarVenta.bind(controller));
router.put('/:id/cancel', controller.cancelSale.bind(controller));
router.put('/:id/observation', authMiddleware, controller.updateObservation.bind(controller));

router.post('/budget', authMiddleware, budgetController.generateBudgetPdf.bind(budgetController));
router.put('/:id/budget', authMiddleware, controller.markAsBudget.bind(controller));

export default router;

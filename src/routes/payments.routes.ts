import { Router } from "express";
import { PaymentsController } from "../controllers/payments.controller";

const router = Router();
const controller = PaymentsController.getInstance();

// POST /api/payments
router.post('/', controller.createPayment.bind(controller));

// POST /api/payments/mercadopago/preference
router.post('/mercadopago/preference', controller.createMercadoPagoPreference.bind(controller));

// POST /api/payments/mercadopago/webhook
router.post('/mercadopago/webhook', controller.handleWebhook.bind(controller));

// POST /api/payments/mercadopago/qr
router.post('/mercadopago/qr', controller.createInStoreQr.bind(controller));

// POST /api/payments/mercadopago/point
router.post('/mercadopago/point', controller.createPointPayment.bind(controller));

// POST /api/payments/manual
router.post('/manual', controller.createManualPayment.bind(controller));

// GET /api/payments/:venta_id
router.get('/:venta_id', controller.getPaymentsBySaleId.bind(controller));

export default router;

import { Router } from "express";
import { PaymentsController } from "../controllers/payments.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = PaymentsController.getInstance();

router.post('/', authMiddleware, controller.createPayment.bind(controller));

router.post('/mercadopago/preference', authMiddleware, controller.createMercadoPagoPreference.bind(controller));
router.post('/mercadopago/webhook', controller.handleWebhook.bind(controller));
router.post('/mercadopago/qr', authMiddleware, controller.createInStoreQr.bind(controller));
router.post('/mercadopago/point', authMiddleware, controller.createPointPayment.bind(controller));
router.post('/mercadopago/dynamic', authMiddleware, controller.createDynamicQR.bind(controller));
router.get('/mercadopago/devices', authMiddleware, controller.getPointDevices.bind(controller));
router.post('/manual', authMiddleware, controller.createManualPayment.bind(controller));
router.get('/:venta_id', authMiddleware, controller.getPaymentsBySaleId.bind(controller));

export default router;

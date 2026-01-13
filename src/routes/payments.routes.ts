import { Router } from "express";
import { PaymentsController } from "../controllers/payments.controller";

const router = Router();
const controller = PaymentsController.getInstance();

router.post('/', controller.createPayment.bind(controller));

router.post('/mercadopago/preference', controller.createMercadoPagoPreference.bind(controller));
router.post('/mercadopago/webhook', controller.handleWebhook.bind(controller));
router.post('/mercadopago/qr', controller.createInStoreQr.bind(controller));
router.post('/mercadopago/point', controller.createPointPayment.bind(controller));
router.post('/mercadopago/dynamic', controller.createDynamicQR.bind(controller));
router.get('/mercadopago/devices', controller.getPointDevices.bind(controller));
router.post('/manual', controller.createManualPayment.bind(controller));
router.get('/:venta_id', controller.getPaymentsBySaleId.bind(controller));

export default router;

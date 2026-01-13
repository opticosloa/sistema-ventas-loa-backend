import { Request, Response } from 'express';
import { Payment } from '../types/payments';
import { PaymentService } from '../service/payment.service';

export class PaymentsController {
    private static instance: PaymentsController;

    private constructor() { }

    public static getInstance(): PaymentsController {
        if (!PaymentsController.instance) {
            PaymentsController.instance = new PaymentsController();
        }
        return PaymentsController.instance;
    }

    public async createPayment(req: Request, res: Response) {
        const paymentData: Payment = req.body;
        try {
            const result = await PaymentService.getInstance().createPayment(paymentData);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async createMercadoPagoPreference(req: Request, res: Response) {
        const { venta_id, monto, title } = req.body;

        try {
            const result = await PaymentService.getInstance().createMercadoPagoPreference(venta_id, monto, title);
            res.json({ success: true, ...result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    }

    public async createInStoreQr(req: Request, res: Response) {
        const { venta_id, monto, title } = req.body;

        try {
            const result = await PaymentService.getInstance().createInStoreOrder(venta_id, monto, title);
            res.json({ success: true, ...result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    }

    public async createPointPayment(req: Request, res: Response) {
        const { venta_id, monto, device_id } = req.body;
        // Prioritize body device_id, fallback to envs
        const targetDeviceId = device_id || process.env.MP_POINT_DEVICE_ID;

        try {
            const result = await PaymentService.getInstance().createPointPayment(venta_id, monto, targetDeviceId);
            res.json(result);
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    }

    public async handleWebhook(req: Request, res: Response) {
        // Log para depuración en ngrok
        console.log("Webhook recibido:", JSON.stringify(req.body, null, 2));

        const { type, action, data } = req.body;

        // El ID puede venir en req.body.data.id (Webhooks) o req.query.id (IPN)
        const resourceId = data?.id || req.query.id || req.query['data.id'];

        // El tipo de evento (payment, plan, merchant_order, etc)
        const resourceType = type || action || req.query.topic;

        // El preference_id solo vendrá aquí si lo configuraste manualmente en la URL de notificación
        const mp_preference_id = req.query.preference_id as string;

        try {
            // Pasamos el resourceId para que el servicio busque los detalles en la API de MP
            const found = await PaymentService.getInstance().handleMPWebhook(mp_preference_id, resourceType, resourceId, data);

            if (found === false) {
                res.status(404).json({ error: 'Payment not found yet' });
            } else {
                res.sendStatus(200);
            }
        } catch (error) {
            console.error("Error procesando webhook:", error);
            res.sendStatus(500);
        }
    }

    public async createManualPayment(req: Request, res: Response) {
        const { venta_id, pagos } = req.body; // Extraemos el array 'pagos'

        try {
            if (!pagos || !Array.isArray(pagos)) {
                return res.status(400).json({ success: false, error: "Array de pagos requerido" });
            }

            const resultados = [];
            for (const p of pagos) {
                // Llamamos al servicio por cada pago del array
                const resPago = await PaymentService.getInstance().createManualPayment(
                    venta_id,
                    p.metodo,
                    p.monto
                );
                resultados.push(resPago);
            }

            res.json({ success: true, result: resultados });
        } catch (error: any) {
            console.log(error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getPaymentsBySaleId(req: Request, res: Response) {
        const { venta_id } = req.params;
        try {
            const result = await PaymentService.getInstance().getPaymentsBySaleId(venta_id as string);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    }

    public async getPointDevices(req: Request, res: Response) {
        try {
            const result = await PaymentService.getInstance().getPointDevices();
            res.json({ success: true, result });
        } catch (error: any) {
            console.log(error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async createDynamicQR(req: Request, res: Response) {
        const { total, sucursal_id } = req.body;
        try {
            const result = await PaymentService.getInstance().createDynamicQR(total, sucursal_id);
            res.json({ success: true, result });
        } catch (error: any) {
            console.log('ERROR: creando QR dinamico: ', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

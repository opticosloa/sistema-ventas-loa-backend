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
        // Prioritize authenticated user's branch, fallback to body (if useful for dev/testing)
        const sucursal_id = req.user?.sucursal_id || req.body.sucursal_id;

        if (!sucursal_id) {
            return res.status(400).json({ success: false, error: 'sucursal_id is required' });
        }

        try {
            const result = await PaymentService.getInstance().createMercadoPagoPreference(venta_id, monto, title, sucursal_id);
            res.json({ success: true, ...result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    }

    public async createInStoreQr(req: Request, res: Response) {
        const { venta_id, monto, title } = req.body;
        const sucursal_id = req.user?.sucursal_id || req.body.sucursal_id;

        if (!sucursal_id) {
            return res.status(400).json({ success: false, error: 'sucursal_id is required' });
        }

        try {
            const result = await PaymentService.getInstance().createInStoreOrder(venta_id, monto, title, sucursal_id);
            res.json({ success: true, ...result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    }

    public async createPointPayment(req: Request, res: Response) {
        const { venta_id, monto, device_id } = req.body;
        const sucursal_id = req.user?.sucursal_id || req.body.sucursal_id;

        if (!sucursal_id) {
            return res.status(400).json({ success: false, error: 'sucursal_id is required for Point Payment' });
        }

        // Prioritize body device_id, fallback to envs
        const targetDeviceId = device_id || process.env.MP_POINT_DEVICE_ID;

        try {
            // Pass sucursal_id to service
            const result = await PaymentService.getInstance().createPointPayment(venta_id, monto, targetDeviceId, sucursal_id);
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

        console.log('DATA: ', data);
        // El ID puede venir en req.body.data.id (Webhooks) o req.query.id (IPN)
        let resourceId = data?.id || req.query.id || req.query['data.id'];
        // El tipo de evento (payment, plan, merchant_order, etc)
        let resourceType = type || action || req.query.topic;
        // El preference_id solo vendrá aquí si lo configuraste manualmente en la URL de notificación
        const mp_preference_id = req.query.preference_id as string;
        // Sucursal ID para multi-tenant (si viene del query param que configuramos en notification_url)
        const sucursal_id = req.query.sucursal_id as string;

        if (!resourceType && (req.body.intent_type || req.body.payment || req.body.id)) {
            console.log("📍 Webhook Point Detectado!");
            resourceType = 'payment'; // Lo tratamos como un pago normal

            // INTENT ID (from Point) is often in 'id' or 'payment.id'
            // Point often sends { id: "...", intent_type: "payment", ... }
            resourceId = req.body.payment?.id || req.body.id;
        }

        console.log(`Procesando como: Type=${resourceType}, ID=${resourceId}, Sucursal=${sucursal_id}`);

        try {
            // Pasamos el resourceId para que el servicio busque los detalles en la API de MP
            const found = await PaymentService.getInstance().handleMPWebhook(
                sucursal_id,
                mp_preference_id,
                resourceType,
                resourceId,
                data
            );
            // [DEBUG]
            console.log(`🏁 [Controller] Fin proceso servicio. Resultado (found):`, found);

            if (found === false) {
                res.status(404).json({ error: 'Payment not found yet' });
            } else {
                res.sendStatus(200);
            }
        } catch (error) {
            console.error("Error procesando webhook:", error);
            // Silent error handling: return 200 OK to stop MP retries on internal errors
            res.status(200).json({ status: 'error_handled', message: 'Internal error logged' });
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
                    p.monto,
                    p.referencia || null
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
            const sucursal_id = req.user?.sucursal_id || req.body.sucursal_id;

            if (!sucursal_id) {
                return res.status(400).json({ success: false, error: 'sucursal_id is required' });
            }

            const result = await PaymentService.getInstance().getPointDevices(sucursal_id);
            res.json({ success: true, result });
        } catch (error: any) {
            console.log(error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async createDynamicQR(req: Request, res: Response) {
        const { total, venta_id } = req.body;
        const sucursal_id = req.user?.sucursal_id || req.body.sucursal_id;

        if (!sucursal_id) {
            return res.status(400).json({ success: false, error: 'sucursal_id is required' });
        }

        try {
            const result = await PaymentService.getInstance().createDynamicQR(total, sucursal_id, venta_id);
            res.json({ success: true, result });
        } catch (error: any) {
            console.log('ERROR: creando QR dinamico: ', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

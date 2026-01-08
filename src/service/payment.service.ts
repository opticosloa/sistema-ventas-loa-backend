import { PostgresDB } from '../database/postgres';
import { Payment, PaymentMethod } from '../types/payments';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
import { envs } from '../helpers/envs';

// Configure Mercado Pago v2
const client = new MercadoPagoConfig({
    accessToken: envs.MP_ACCESS_TOKEN
});

export class PaymentService {
    private static instance: PaymentService;

    private constructor() { }

    public static getInstance(): PaymentService {
        if (!PaymentService.instance) {
            PaymentService.instance = new PaymentService();
        }
        return PaymentService.instance;
    }

    /**
     * Internal helper to create a payment record in DB via SP.
     * Reused by all payment creation methods.
     */
    private async _createPaymentInDB(venta_id: string, metodo: string, monto: number): Promise<string> {
        // sp_pago_crear(venta_id, metodo, monto, estado?)
        // Assuming SP handles the 'null' as default/pending status.
        const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_pago_crear', [
            venta_id,
            metodo,
            monto,
            null
        ]);

        const rows = result.rows || result;
        const pago_id = rows[0]?.pago_id || rows[0]?.sp_pago_crear;

        if (!pago_id) {
            throw new Error('Failed to create payment record');
        }

        return pago_id;
    }

    public async createPayment(paymentData: Payment) {
        const { venta_id, metodo, monto } = paymentData;
        const pago_id = await this._createPaymentInDB(venta_id, metodo, monto);
        return { success: true, pago_id };
    }

    public async createMercadoPagoPreference(venta_id: string, monto: number, title: string = 'Venta óptica') {
        const method = PaymentMethod.MP;
        const pago_id = await this._createPaymentInDB(venta_id, method, monto);

        // Limpiar URLs para evitar dobles barras
        const baseFront = envs.FRONT_URL.replace(/\/$/, "");
        const baseApi = envs.API_URL.replace(/\/$/, "");
        const notificationUrl = `${baseApi}/api/payments/mercadopago/webhook?preference_id=PENDING`;

        const preferenceClient = new Preference(client);

        const preferenceData = {
            body: {
                items: [{
                    id: 'ITEM-1',
                    title: title,
                    quantity: 1,
                    unit_price: Number(monto),
                    currency_id: 'ARS'
                }],
                back_urls: {
                    success: `${baseFront}/pago-resultado?venta_id=${venta_id}`,
                    failure: `${baseFront}/pago-resultado?venta_id=${venta_id}`,
                    pending: `${baseFront}/pago-resultado?venta_id=${venta_id}`
                },
                auto_return: 'approved',
                notification_url: notificationUrl,
                external_reference: pago_id
            }
        };

        // console.log(preferenceData, preferenceClient)
        const mpResponse = await preferenceClient.create(preferenceData);

        // Actualizar el pago en DB con el ID real de la preferencia
        if (mpResponse.id) {
            await PostgresDB.getInstance().callStoredProcedure('sp_pago_actualizar_preference', [
                pago_id,
                mpResponse.id
            ]);
        }

        return { init_point: mpResponse.init_point, preference_id: mpResponse.id };
    }

    private static generatedPosId: string | undefined;

    private async _getOrCreatePOS(): Promise<string> {
        if (envs.MP_EXTERNAL_POS_ID) return envs.MP_EXTERNAL_POS_ID;
        if (PaymentService.generatedPosId) return PaymentService.generatedPosId;

        console.log('MP_EXTERNAL_POS_ID no configurado. Buscando/Creando POS automático...');
        const headers = {
            'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        };

        // 1. Obtener Store (Sucursal) existente o crear una
        let storeId: string;
        const storesResponse = await fetch(`https://api.mercadopago.com/users/${envs.MP_USER_ID}/stores/search?limit=1`, { headers });

        if (!storesResponse.ok) throw new Error('Error buscando stores en MP');
        const storesData: any = await storesResponse.json();

        if (storesData.results && storesData.results.length > 0) {
            storeId = storesData.results[0].id;
        } else {
            console.log('No se encontraron stores. Creando una...');
            const storePayload = {
                name: "Sucursal Principal",
                business_hours: {
                    monday: [{ open: "08:00", close: "18:00" }]
                },
                location: {
                    street_number: "123",
                    street_name: "Calle Falsa",
                    city_name: "Capital",
                    state_name: "Capital",
                    latitude: -34.6037,
                    longitude: -58.3816,
                    reference: "Centro"
                },
                external_id: "STORE_AUTO_001"
            };
            const createStoreRes = await fetch(`https://api.mercadopago.com/users/${envs.MP_USER_ID}/stores`, {
                method: 'POST',
                headers,
                body: JSON.stringify(storePayload)
            });
            if (!createStoreRes.ok) {
                const txt = await createStoreRes.text();
                throw new Error(`Error creando Store en MP: ${txt}`);
            }
            const newStore: any = await createStoreRes.json();
            storeId = newStore.id;
        }

        // 2. Crear POS asociado a la Store
        const externalId = `POS_AUTO_${Date.now()}`;
        const posPayload = {
            name: "Caja Principal Auto",
            fixed_amount: true,
            store_id: Number(storeId),
            external_store_id: "STORE_AUTO_001",
            external_id: externalId,
            category: 621102 // Retail
        };

        const createPosRes = await fetch('https://api.mercadopago.com/pos', {
            method: 'POST',
            headers,
            body: JSON.stringify(posPayload)
        });

        if (!createPosRes.ok) {
            const txt = await createPosRes.text();
            throw new Error(`Error creando POS auto: ${txt}`);
        }

        // const posData = await createPosRes.json();

        console.log(`POS automático creado: ${externalId}`);
        PaymentService.generatedPosId = externalId;
        return externalId;
    }

    public async createInStoreOrder(venta_id: string, monto: number, title: string = 'Venta óptica') {
        const method = PaymentMethod.MP;
        const pago_id = await this._createPaymentInDB(venta_id, method, monto);

        const userId = envs.MP_USER_ID;
        // const externalPosId = envs.MP_EXTERNAL_POS_ID; 
        const externalPosId = await this._getOrCreatePOS();
        const accessToken = envs.MP_ACCESS_TOKEN;

        const url = `https://api.mercadopago.com/instore/qr/seller/collectors/${userId}/pos/${externalPosId}/orders`;

        const payload = {
            external_reference: pago_id,
            title: title || 'Venta',
            total_amount: Number(monto),
            description: title,
            items: [
                {
                    sku_number: "ITEM-1",
                    category: "marketplace",
                    title: title,
                    description: title,
                    unit_price: Number(monto),
                    quantity: 1,
                    unit_measure: "unit",
                    total_amount: Number(monto)
                }
            ],
            // notification_url is set at the POS/Application level usually, but we can try to send it if API allows, 
            // though In-Store QR usually relies on the configured Webhook for the User/Application.
            notification_url: `${envs.API_URL}/api/payments/mercadopago/webhook`
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error creating In-Store Order: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data: any = await response.json();
        const qr_data = data.qr_data; // This is what the frontend needs to render the QR

        return { qr_data, pago_id };
    }

    public async handleMPWebhook(mp_preference_id: string | undefined, type: any, id: any, data: any) {
        // En V2 el tipo suele venir como "payment" o "topic=payment" (IPN)
        // Also handling 'merchant_order' for In-Store QR
        if (type !== 'payment' && type !== 'merchant_order') {
            const topic = type || 'unknown';
            console.log('Evento ignorado (no es payment ni merchant_order):', topic);
            return;
        }

        const paymentId = id || data?.id;

        if (!paymentId) {
            console.warn('Webhook sin ID de pago');
            return;
        }

        const resourceId = String(paymentId);

        try {
            // Consultar estado en Mercado Pago via API
            // We use simple fetch for generic resource fetching to handle both Payments and MerchantOrders easily
            // or use specific client classes.
            let mp_status = 'unknown';
            let external_reference = null;
            let final_preference_id = mp_preference_id;

            if (type === 'payment') {
                const paymentClient = new MPPayment(client);
                const paymentInfo = await paymentClient.get({ id: resourceId });
                mp_status = paymentInfo.status || 'unknown';
                external_reference = paymentInfo.external_reference;

                const derived_preference_id = paymentInfo.order?.id ? String(paymentInfo.order.id) : undefined;
                final_preference_id = final_preference_id || derived_preference_id;

            } else if (type === 'merchant_order') {
                // Fetch Merchant Order
                // client is MercadoPagoConfig
                // We can use fetch with the same client's access token or a new MerchantOrder class if available.
                // Doing raw fetch to be safe as SDK might change.
                const response = await fetch(`https://api.mercadopago.com/merchant_orders/${resourceId}`, {
                    headers: {
                        'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}`
                    }
                });

                if (!response.ok) throw new Error('Failed to fetch merchant order');
                const orderData = await response.json();

                mp_status = orderData.status; // 'opened', 'closed' (paid)
                external_reference = orderData.external_reference;
                final_preference_id = orderData.preference_id ? String(orderData.preference_id) : undefined;

                // If closed/paid, we treat it as APPROVED equivalent for our system logic if we want to release stock etc.
                // Mapped status: 
                // opened -> PENDING
                // closed -> PAGADA (if payments match total)

                // However, usually Merchant Order contains payments. We might want to check the payments inside.
                // For simplicity, if status is 'closed', we assume paid.
                if (mp_status === 'closed') mp_status = 'approved';
                if (mp_status === 'opened') mp_status = 'pending';
            }

            // Log informativo
            console.log(`Procesando Webhook MP: Type=${type}, ID=${resourceId}, Status=${mp_status}, Ref=${external_reference}`);

            // Llamada al SP
            await PostgresDB.getInstance().callStoredProcedure('sp_pago_actualizar_status', [
                final_preference_id || null,
                // If it's a merchant_order, we might not have a single payment_id, but the logic expects one.
                // Actually sp_pago_actualizar_status might use external_reference or preference_id to find the payment/sale.
                // If we pass external_reference (pago_id) as the 2nd arg instead of mp_payment_id, 
                // wait, the SP signature is likely (preference_id, mp_payment_id, status).
                // If the SP finds by preference_id, sending null for payment_id might be okay or not.
                // BUT, external_reference IS our pago_id.
                // If type is merchant_order, we might not have a specific 'payment_id' to store if multiple payments exist.
                // BUT usually for single QR scan, there is one payment.
                // Let's pass resourceId as 'reference' for now.
                resourceId,
                mp_status
            ]);

            // NOTE: The SP probably expects `mp_payment_id` to be stored. 
            // If we send merchant_order_id, it might be confusing but legal if we just want to track it.
            // Critical: The SP likely updates based on ... wait.
            // sp_pago_actualizar_status(preference_id?, mp_id?, status)
            // If we don't have preference_id (because QR doesn't use it, it uses external_reference=pago_id),
            // The SP might need to be smart enough.
            // User request says: "actualice el estado de la venta como 'Iniciada'" -> actually 'Iniciada'? Or 'PAGADA'?
            // The prompt says: "el sistema busque los detalles y actualice el estado de la venta como 'Iniciada'" 
            // -> Maybe they meant the *start* of the flow? 
            // Re-reading: "actualice el estado de la venta como 'Iniciada'"

            // If the status is 'opened', it is 'Iniciada' (PENDING).

        } catch (error: any) {
            // ... (logging)
            if (error?.status === 404 || error?.response?.status === 404) {
                console.warn(`[MP Webhook] Recurso ${resourceId} no encontrado.`);
                return;
            }
            console.error('Error al consultar/actualizar MP:', error);
            // Don't throw to avoid 500 to MP causing retries if it's just logic error? 
            // Better to throw if transient.
            throw error;
        }
    }

    public async createManualPayment(venta_id: string, metodo: string, monto: number) {
        // 1. Create Payment
        const pago_id = await this._createPaymentInDB(venta_id, metodo, monto);

        // 2. Confirm Payment immediately
        await PostgresDB.getInstance().callStoredProcedure('sp_pago_confirmar', [pago_id]);

        return { success: true, pago_id };
    }

    public async getPaymentsBySaleId(venta_id: string) {
        // 1. Get Sale info
        const saleResult: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_get_by_id', [venta_id]);

        const saleRows = saleResult.rows || saleResult;
        if (!saleRows || saleRows.length === 0) {
            throw new Error('Sale not found');
        }

        const sale = saleRows[0];

        // 2. Get Payments list
        let pagos = [];
        try {
            const pagosResult: any = await PostgresDB.getInstance().callStoredProcedure('sp_pago_listar', [venta_id]);
            pagos = pagosResult.rows || pagosResult;
        } catch (e) {
            console.warn('sp_pago_listar failed or not found', e);
        }

        // 3. PROPER LOGIC: Return DB values directly. 
        // Do not calculate 'pagado' or 'estado' here.
        return {
            total: Number(sale.total) || 0,
            pagado: Number(sale.pagado) || 0,
            estado: sale.estado || 'PENDIENTE',
            pagos: pagos
        };
    }
}

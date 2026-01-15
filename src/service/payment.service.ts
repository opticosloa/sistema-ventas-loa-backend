import { PostgresDB } from '../database/postgres';
import { Payment, PaymentMethod } from '../types/payments';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
import { envs } from '../helpers/envs';
import { randomUUID } from 'crypto';

// Configure Mercado Pago v2
const client = new MercadoPagoConfig({
    accessToken: envs.MP_ACCESS_TOKEN
});

export class PaymentService {
    private static instance: PaymentService;
    private posIdCache: Map<string, string> = new Map();

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
        // Log de seguridad
        console.log("Registrando pago en DB:", { venta_id, metodo, monto });

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

        if (!rows || rows.length === 0) {
            throw new Error("SP sp_pago_crear no devolvió filas");
        }
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
        // 1. Determine Fixed External ID
        const targetExternalId = (envs.MP_EXTERNAL_POS_ID || 'CAJALUJAN01').replace(/[^a-zA-Z0-9]/g, '');

        const headers = {
            'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        };

        console.log(`🔍 Buscando POS con ID Limpio: ${targetExternalId}`);

        // 2. Search First (Idempotency)
        try {
            const searchRes = await fetch(`https://api.mercadopago.com/pos?external_id=${targetExternalId}`, { headers });
            if (searchRes.ok) {
                const searchData: any = await searchRes.json();
                // results o paging? MP POS API returns { results: [...] } usually
                const results = searchData.results || [];
                if (results.length > 0) {
                    const existingPos = results[0];
                    console.log(`✅ POS encontrado: ${existingPos.name} (ID Interno: ${existingPos.id})`);
                    return targetExternalId;
                }
            }
        } catch (error) {
            console.warn("⚠️ Error buscando POS existente, intentando crear uno nuevo...", error);
        }

        console.log(`POS '${targetExternalId}' no existe. Iniciando creación...`);

        // 3. Create Store if needed (Only required if creating POS)
        let storeId: string;
        try {
            const storesResponse = await fetch(`https://api.mercadopago.com/users/${envs.MP_USER_ID}/stores/search?limit=1`, { headers });
            if (!storesResponse.ok) throw new Error('Error buscando stores en MP');

            const storesData: any = await storesResponse.json();
            if (storesData.results && storesData.results.length > 0) {
                storeId = storesData.results[0].id;
                console.log(`🏢 Store encontrada: ${storesData.results[0].name} (${storeId})`);
            } else {
                console.log('🏢 No se encontraron stores. Creando una nueva...');
                const storePayload = {
                    name: "Sucursal Principal LOA",
                    business_hours: {
                        monday: [{ open: "08:00", close: "20:00" }]
                    },
                    location: {
                        street_number: "123",
                        street_name: "Calle Principal",
                        city_name: "Ciudad",
                        state_name: "Estado",
                        latitude: -34.6037,
                        longitude: -58.3816,
                        reference: "Centro"
                    }, // Default dummy location if not provided
                    external_id: "STORE_LOA_MAIN"
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
        } catch (error) {
            console.error("Error gestionando Store:", error);
            throw error;
        }

        // 4. Create POS associated to Store
        const posPayload = {
            name: "Caja Principal LOA",
            fixed_amount: true,
            store_id: Number(storeId),
            external_id: targetExternalId,
            category: 621102 // Retail
        };

        const createPosRes = await fetch('https://api.mercadopago.com/pos', {
            method: 'POST',
            headers,
            body: JSON.stringify(posPayload)
        });

        if (!createPosRes.ok) {
            const txt = await createPosRes.text();
            throw new Error(`Error creando POS: ${txt}`);
        }

        console.log(`✅ POS creado exitosamente: ${targetExternalId}`);

        // 5. Propagation Delay (Only on creation)
        console.log("Esperando 2 segundos para propagación...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        return targetExternalId;
    }

    public async getPointDevices() {
        try {
            console.log("📡 Consultando dispositivos Point a MP...");
            const response = await fetch('https://api.mercadopago.com/terminals/v1/list', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorTxt = await response.text();
                throw new Error(`MP API Error: ${response.status} - ${errorTxt}`);
            }

            const data = await response.json();
            console.log("📱 Dispositivos encontrados en crudo:", JSON.stringify(data));
            const devices = data.data?.terminals || [];
            console.log(`✅ ${devices.length} dispositivos encontrados.`);
            return devices;
        } catch (error) {
            console.error("Error en getPointDevices:", error);
            // Devolvemos array vacío en caso de error para no romper el front, pero loggeamos.
            // Opcional: lanzar error si prefieres manejarlo en el controlador.
            throw error;
        }
    }

    public async createInStoreOrder(venta_id: string, monto: number, title: string = 'Venta óptica') {
        const method = PaymentMethod.MP;
        const pago_id = await this._createPaymentInDB(venta_id, method, monto);

        // 1. Obtener User ID dinámico
        const meRes = await fetch('https://api.mercadopago.com/users/me', {
            headers: { 'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}` }
        });
        if (!meRes.ok) throw new Error("Could not fetch MP User ID");
        const meData: any = await meRes.json();
        const userId = meData.id;

        // 2. Obtener/Validar POS
        const externalPosId = await this._getOrCreatePOS();
        const accessToken = envs.MP_ACCESS_TOKEN;

        const url = `https://api.mercadopago.com/instore/qr/seller/collectors/${userId}/pos/${externalPosId}/orders`;

        // 3. Payload Limpio y Validado
        const totalAmount = parseFloat(Number(monto).toFixed(2)); // Aseguramos 2 decimales máx.

        //  SE MODIFICÓ DESPUES DE QUE LOS PAGOS POR POINT FUNCIONEN, BORRAR SI PASA ALGO Y USAR API_URL EN notification_url
        // Limpiar URL base
        const baseApi = envs.API_URL.replace(/\/$/, "");

        const payload = {
            external_reference: pago_id.toString(),
            title: title.substring(0, 25), // MP tiene límites de caracteres
            total_amount: totalAmount,
            description: "Venta de productos ópticos",
            items: [
                {
                    sku_number: "V-" + venta_id.toString().slice(0, 8),
                    category: "others", // 'others' es más genérico y falla menos que 'marketplace'
                    title: title.substring(0, 25),
                    unit_price: totalAmount,
                    quantity: 1,
                    unit_measure: "unit",
                    total_amount: totalAmount
                }
            ],
            notification_url: `${baseApi}/api/payments/mercadopago/webhook`
        };

        console.log("📡 Enviando orden a MP:", JSON.stringify(payload));

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 204) {
            console.log("MP respondió 204 No Content (Orden creada, QR ya visible en POS o Pantalla)");
            return { qr_data: null, pago_id, status: 'no_content' };
        }

        const text = await response.text();
        console.log("Respuesta cruda de MP:", text);

        if (!response.ok) {
            throw new Error(`Error MP (${response.status}): ${text}`);
        }

        let data: any = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error("Respuesta de Mercado Pago no es un JSON válido");
        }

        // A veces MP devuelve el QR en diferentes campos según la versión de la API
        const qr_data = data.qr_data || data.qr_code || data.pago_id;

        if (!qr_data) {
            // LOG CRÍTICO para ver qué devolvió realmente
            console.error("MP NO DEVOLVIÓ QR. Respuesta completa:", data);
            throw new Error(`Mercado Pago no generó el QR. Status: ${response.status}`);
        }

        return { qr_data, pago_id };
    }

    public async createPointPayment(venta_id: string, monto: number, device_id: string) {
        if (!device_id) throw new Error("Device ID is required for Point Payment");
        // 1. Create local payment reference
        const pago_id = await this._createPaymentInDB(venta_id, 'MP_POINT', monto);

        // 2. Create Payment Intent
        const url = `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`;
        const payload = {
            amount: Math.round(monto * 100), // Importante: Point suele pedir el monto en CENTAVOS (ej: $15.00 -> 1500)
            additional_info: {
                external_reference: pago_id, // Esto sí es útil
                print_on_terminal: true // Opcional, si quieres que imprima ticket
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const txt = await response.text();
            let errorData: any = {};
            try { errorData = JSON.parse(txt); } catch (e) { }

            // CASO ESPECÍFICO: TERMINAL OCUPADA (Error 409 / 2205)
            if (response.status === 409) {
                // Opción A: Intentar borrar la orden anterior automáticamente (Avanzado)
                // Opción B: Avisar al usuario (Más seguro)
                throw new Error("⚠️ La terminal está ocupada con una operación anterior. Por favor presione el botón ROJO (Cancelar) en el dispositivo e intente nuevamente.");
            }

            throw new Error(`Error Point: ${errorData.message || txt}`);
        }

        const data = await response.json();
        /* 
           Response usually contains:
           { "id": "...", "status": "OPEN", "amount": 1500, ... }
        */
        console.log(data);
        // Optionally, we could store the intent_id if needed, but external_reference links it back.
        return { success: true, intent_id: data.id, pago_id, status: data.status };
    }

    public async handleMPWebhook(mp_preference_id: string | undefined, type: any, id: any, data: any) {
        // 1. Filtro de eventos
        if (type !== 'payment' && type !== 'merchant_order' && type !== 'order') {
            console.log('Evento ignorado:', type);
            return;
        }

        const paymentId = id || data?.id;
        if (!paymentId) {
            console.warn('Webhook sin ID de pago');
            return;
        }

        const resourceId = String(paymentId);

        try {
            let raw_status = 'unknown'; // Aquí guardaremos el status crudo en INGLÉS
            let external_reference = null;
            let final_preference_id = mp_preference_id;

            // --- A. Obtener Status CRUDO según el tipo ---
            if (type === 'order') {
                raw_status = data.status; // 'processed', 'opened'
                external_reference = data.external_reference;
            }
            else if (type === 'payment') {
                const paymentClient = new MPPayment(client);
                const paymentInfo = await paymentClient.get({ id: resourceId });

                raw_status = paymentInfo.status || 'unknown';

                const infoExtra = paymentInfo.additional_info as any;

                external_reference = paymentInfo.external_reference ||
                    paymentInfo.metadata?.external_reference ||
                    infoExtra?.external_reference;

                const derived_preference_id = paymentInfo.order?.id ? String(paymentInfo.order.id) : undefined;
                final_preference_id = final_preference_id || derived_preference_id;
            }
            else if (type === 'merchant_order') {
                const response = await fetch(`https://api.mercadopago.com/merchant_orders/${resourceId}`, {
                    headers: { 'Authorization': `Bearer ${envs.MP_ACCESS_TOKEN}` }
                });
                if (!response.ok) throw new Error('Failed to fetch merchant order');
                const orderData = await response.json();

                raw_status = orderData.status;
                external_reference = orderData.external_reference;
                final_preference_id = orderData.preference_id ? String(orderData.preference_id) : undefined;
            }

            console.log(`[Webhook] Info Cruda: Type=${type}, Status=${raw_status}, Ref=${external_reference}`);

            // --- B. Traducir a Estado de Base de Datos (UNA SOLA VEZ) ---
            let db_status = 'PENDIENTE';

            // Lista de estados que consideramos EXITOSOS
            const successStatuses = ['approved', 'processed', 'closed', 'accredited'];
            // Lista de estados que consideramos FALLIDOS
            const failureStatuses = ['rejected', 'cancelled', 'cancelled_by_player'];

            if (successStatuses.includes(raw_status)) {
                db_status = 'APROBADO';
            } else if (failureStatuses.includes(raw_status)) {
                db_status = 'RECHAZADO';
            }
            // Si no es ninguno (ej: 'in_process', 'pending', 'opened'), se queda en 'PENDIENTE'

            // --- C. Actualizar DB ---
            const id_para_buscar = external_reference || final_preference_id;

            if (!id_para_buscar) {
                console.error(`[Webhook] Sin ID de búsqueda para recurso ${resourceId}`);
                return false;
            }

            console.log(`[Webhook] Actualizando DB -> Ref: ${id_para_buscar}, Estado: ${db_status}, resorceId: ${resourceId}`);

            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_pago_actualizar_status', [
                id_para_buscar,
                db_status, // Enviamos 'APROBADO' o 'RECHAZADO'
                resourceId
            ]);

            const updated = result.rows?.[0]?.sp_pago_actualizar_status;

            if (updated === false) {
                console.warn(`[Webhook] Pago no encontrado (Ref: ${id_para_buscar})`);
                return false;
            }

            console.log(`✅ Pago actualizado correctamente a: ${db_status}`);
            return true;

        } catch (error: any) {
            if (error?.status === 404) {
                console.warn(`[Webhook] Recurso MP ${resourceId} no encontrado.`);
                return;
            }
            console.error('Error Webhook:', error);
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

    public async createDynamicQR(total: number, sucursal_id: string, venta_id: string) {
        try {
            //* TODO: HACER QUE LAS CREDENCIALES SEAN DINAMICAS PARA CADA SUCURSAL
            // 1. Obtener credenciales (DB)
            // const credenciales = await this.getSucursalCredentials(sucursal_id);

            const external_pos_id = await this._getOrCreatePOS();
            const access_token = envs.MP_ACCESS_TOKEN;

            const safeTotalStr = Number(total).toFixed(2);
            const pago_id_db = await this._createPaymentInDB(venta_id, 'MP_QR', Number(total));
            // 2. Generar referencias usando crypto nativo
            const external_reference = String(pago_id_db);
            const idempotencyKey = randomUUID();

            // 3. Payload CORREGIDO según el error de propiedades
            const orderPayload = {
                type: "qr",
                external_reference: external_reference,
                description: `Venta Sucursal ${sucursal_id}`,
                total_amount: safeTotalStr,
                items: [
                    {
                        title: "Consumo General",
                        unit_price: safeTotalStr,
                        quantity: 1,
                        unit_measure: "unit"
                    }
                ],
                transactions: {
                    payments: [
                        {
                            amount: safeTotalStr
                        }
                    ]
                },
                config: {
                    qr: {
                        mode: "dynamic",
                        external_pos_id: external_pos_id
                    }
                }
            };

            console.log(orderPayload);
            // 4. Usando FETCH nativo
            const response = await fetch('https://api.mercadopago.com/v1/orders', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify(orderPayload)
            });

            console.log(response);

            // 5. Manejo de errores con fetch (fetch no lanza error en 400/500, hay que verificar .ok)
            const data: any = await response.json();

            if (!response.ok) {
                console.error('❌ ERROR DETALLADO DE MERCADO PAGO:', JSON.stringify(data, null, 2));
                const errorMsg = data.message || data.error || 'Error desconocido de MP';
                throw new Error(`Error Mercado Pago (${response.status}): ${errorMsg}`);
            }

            const qrData = data.type_response?.qr_data;

            if (!qrData) {
                throw new Error("La respuesta de Mercado Pago no contiene qr_data");
            }

            return {
                qr_data: qrData,
                order_id: data.id,
                external_reference: external_reference,
                total: total
            };

        } catch (error: any) {
            console.error('Service Error - createDynamicQR:', error);
            throw error;
        }
    }

    // private async getSucursalCredentials(sucursal_id: string) {
    //     // Tu lógica de DB aquí...
    //     return {
    //         access_token: "TEST-TU-ACCESS-TOKEN-REAL", 
    //         external_pos_id: "SUCURSAL1_POS_TABLET"
    //     };
    // }
}



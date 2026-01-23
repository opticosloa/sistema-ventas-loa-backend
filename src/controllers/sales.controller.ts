import { PostgresDB } from "../database/postgres";
import { Request, Response } from 'express';
import { Sales } from "../types/sales";

export class SalesController {
    private static instance: SalesController;

    private constructor() { }

    public static getInstance(): SalesController {
        if (!SalesController.instance) {
            SalesController.instance = new SalesController();
        }
        return SalesController.instance;
    }

    public async createSale(req: Request, res: Response) {
        let { cliente_id, urgente, descuento, items } = req.body;
        const vendedor_id = req.user?.id;
        const sucursal_id = req.user?.sucursal_id;

        if (!vendedor_id || !sucursal_id) {
            res.status(400).json({ success: false, error: 'User context (id or sucursal) missing' });
            return;
        }

        // Validate UUIDs
        if (cliente_id === "") cliente_id = null;
        if (!cliente_id) {
            return res.status(400).json({ success: false, error: 'cliente_id requerido' });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_crear', [
                vendedor_id,
                cliente_id,
                sucursal_id,
                urgente,
                descuento,
                JSON.stringify(items)
            ]);


            const ventaData = result.rows?.[0]?.sp_venta_crear || result.rows?.[0] || {};
            const venta_id = ventaData?.venta_id;

            if (!venta_id) {
                throw new Error("No se pudo obtener el ID de la venta creada");
            }

            // Ticket is created by SP but Direct Sales should not have one.
            // We delete it immediately.
            // await PostgresDB.getInstance().executeQuery('DELETE FROM tickets WHERE venta_id = $1', [venta_id]);

            // Verificar Total Confirmado
            const totalResult = await PostgresDB.getInstance().callStoredProcedure('sp_venta_get_by_id', [venta_id]);
            const total_confirmado = totalResult.rows?.[0]?.total || 0;

            res.json({
                success: true,
                venta_id,
                total_confirmado
            });
        } catch (error: any) {
            console.error("❌ SALES ERROR:", error.message);
            if (error.detail) console.error("👉 DETAIL:", error.detail);
            res.status(500).json({ success: false, error });
        }
    }

    public async getSales(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_listar');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateSale(req: Request, res: Response) {
        const { id } = req.params;
        const { vendedor_id, despachante_id, cliente_id, urgente, estado, medio_pago, pagado, total }: Sales = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_editar', [
                id,
                vendedor_id,
                despachante_id,
                cliente_id,
                urgente,
                estado,
                medio_pago,
                pagado,
                total
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getSaleById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_get_by_id', [id]);
            if (!result || result.rows.length === 0) {
                return res.status(404).json({ success: false });
            }
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteSale(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async addItem(req: Request, res: Response) {
        const { id } = req.params;
        const { producto_id, cantidad, precio_unitario } = req.body;

        try {
            // Frontend sends the calculated unit price (ARS or USD converted)
            // Call SP directly with passed price
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_item_agregar', [
                id,
                producto_id,
                cantidad,
                precio_unitario || 0
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getEstadoPago(req: Request, res: Response) {
        const { id } = req.params;

        try {
            if (!id) return res.status(400).json({ success: false, error: 'Venta ID requerido' });

            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_estado_pago_get', [id]);
            const estado = result[0] || {};

            if (!estado || (!estado.estado_pago && !estado.estado_venta)) {
                return res.status(404).json({
                    success: false,
                    error: 'Venta no encontrada'
                });
            }

            res.json({
                success: true,
                estado_pago: estado.estado_pago || 'PENDIENTE',
                estado_venta: estado.estado_venta || 'PENDIENTE'
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo estado de pago'
            });
        }
    }

    public async getPendingSalesByDni(req: Request, res: Response) {
        const { dni } = req.params;
        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_get_pending_by_dni', [dni]);
            // SP returns a table, likely result.rows
            const sales = result.rows || result;
            res.json({ success: true, result: sales });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async cancelSale(req: Request, res: Response) {
        const { id } = req.params;
        try {
            await PostgresDB.getInstance().callStoredProcedure('sp_venta_cancelar', [id]);
            res.json({ success: true, message: "Venta cancelada" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async intentarCierre(req: Request, res: Response) {
        const { id: venta_id } = req.params;

        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure(
                'sp_venta_intentar_cierre',
                [venta_id]
            );

            const cerrada = result[0]?.sp_venta_intentar_cierre ?? false;

            res.json({
                success: true,
                cerrada
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false });
        }
    }

    public async entregarVenta(req: Request, res: Response) {
        const { id } = req.params;
        const usuario_id = req.user?.id;

        if (!usuario_id) {
            return res.status(401).json({ success: false });
        }

        try {
            await PostgresDB.getInstance().callStoredProcedure(
                'sp_venta_entregar',
                [id, usuario_id]
            );

            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    public async searchSales(req: Request, res: Response) {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ success: false, error: 'Query parameter q is required' });
        }

        try {
            // Task 2: Use Stored Procedure sp_venta_buscar
            // The SP handles UUID detection and DNI search logic internally.
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_buscar', [q]);

            // Return rows directly as requested
            res.json({ success: true, result: result.rows });

        } catch (error: any) {
            console.error("Search error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async createReturn(req: Request, res: Response) {
        // 1. Recibimos los datos correctos del frontend (DevolucionesPage ya tiene selectedItems)
        // Nota: Agregamos 'motivo' y 'total_reembolsado' que faltaban en el envío
        const { venta_id, items, motivo, total_reembolsado } = req.body;

        try {
            // 2. Llamamos al SP: sp_devolucion_crear(venta_id, total, motivo, items)
            // El SP devuelve un JSON { "success": true, "devolucion_id": "..." }
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_devolucion_crear', [
                venta_id,
                total_reembolsado || 0,        // Numeric
                motivo || 'Devolución cliente', // Text
                JSON.stringify(items)          // JSONB
            ]);

            // El resultado de una función que retorna JSON suele estar en la primera columna de la primera fila
            const rawResponse = result.rows[0];
            const spResponse = rawResponse?.sp_devolucion_crear || rawResponse;

            res.json({ success: true, result: spResponse });
        } catch (error: any) {
            console.error("Error en createReturn:", error);
            res.status(500).json({ success: false, error: error.message || error });
        }
    }

    public async markAsBudget(req: Request, res: Response) {
        const { id } = req.params;
        try {

            await PostgresDB.getInstance().callStoredProcedure('sp_venta_cambiar_estado', [id, 'PRESUPUESTO']);
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateObservation(req: Request, res: Response) {
        const { id } = req.params;
        const { observation } = req.body;

        if (!observation) {
            return res.status(400).json({ success: false, error: 'La observación no puede estar vacía' });
        }

        try {
            // Llamamos al Stored Procedure
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_agregar_observacion', [
                id,
                observation
            ]);

            // Verificamos si la venta existía
            if (!result.rows || result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Venta no encontrada' });
            }

            res.json({
                success: true,
                result: result.rows[0] // Retorna las observaciones actualizadas
            });

        } catch (error: any) {
            console.error("Error en updateObservation (SP):", error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async coverInsurance(req: Request, res: Response) {
        const { venta_id, obra_social_id, nro_orden } = req.body;

        if (!venta_id || !obra_social_id || !nro_orden) {
            return res.status(400).json({ success: false, error: "Datos incompletos para procesar la cobertura." });
        }

        try {
            // Ejecutamos el SP que hace todo el trabajo pesado
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_aplicar_cobertura_os', [
                venta_id,
                obra_social_id,
                nro_orden
            ]);

            const montoCubierto = result.rows[0].sp_venta_aplicar_cobertura_os;

            if (Number(montoCubierto) === 0) {
                return res.status(400).json({
                    success: false,
                    error: "La venta no contiene cristales o marcos elegibles para cobertura."
                });
            }

            res.json({
                success: true,
                covered_amount: Number(montoCubierto),
                message: `Se aplicó una cobertura de $${montoCubierto} exitosamente.`
            });

        } catch (error: any) {
            console.error("Error en SP sp_venta_aplicar_cobertura_os:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

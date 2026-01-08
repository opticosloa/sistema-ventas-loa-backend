import { PostgresDB } from "../database/postgres";
import { Request, Response } from 'express';
import { Sales } from "../types/sales";
import { SalesService } from "../service/sales.service";

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
        const { cliente_id, urgente } = req.body;

        const vendedor_id = req.user?.id;
        const sucursal_id = req.user?.sucursal_id;

        if (!vendedor_id || !sucursal_id) {
            res.status(400).json({ success: false, error: 'User context (id or sucursal) missing' });
            return;
        }

        if (!cliente_id) {
            return res.status(400).json({ success: false, error: 'cliente_id requerido' });
        }

        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_crear', [
                vendedor_id,
                cliente_id,
                sucursal_id,
                urgente ?? false
            ]);
            const venta_id = result[0]?.sp_venta_crear || result[0]?.venta_id;

            res.json({ success: true, venta_id });
        } catch (error) {
            console.log(error);
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
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_item_agregar', [
                id,
                producto_id,
                cantidad,
                precio_unitario
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

            const result = await SalesService.getInstance().getEstadoPago(id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Venta no encontrada'
                });
            }

            res.json({
                success: true,
                estado_pago: result?.estado_pago || 'PENDIENTE',
                estado_venta: result?.estado_venta || 'PENDIENTE'
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


}

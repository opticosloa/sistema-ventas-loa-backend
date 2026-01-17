import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';

import { SalesItem } from "../types/sales_item";

export class SalesItemsController {
    private static instance: SalesItemsController;

    private constructor() { }

    public static getInstance(): SalesItemsController {
        if (!SalesItemsController.instance) {
            SalesItemsController.instance = new SalesItemsController();
        }
        return SalesItemsController.instance;
    }

    public async createSalesItem(req: Request, res: Response) {
        const { venta_id, producto_id, cantidad, precio_unitario }: SalesItem = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_item_crear', [
                venta_id,
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

    public async getSalesItemsBySaleId(req: Request, res: Response) {
        const { venta_id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_item_listar_por_venta', [venta_id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateSalesItem(req: Request, res: Response) {
        const { id } = req.params;
        const { cantidad, precio_unitario, subtotal }: SalesItem = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_item_editar', [
                id,
                cantidad,
                precio_unitario,
                subtotal
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteSalesItem(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_venta_item_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }
}

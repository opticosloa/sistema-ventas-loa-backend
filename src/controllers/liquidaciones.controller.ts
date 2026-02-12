import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';

export class LiquidacionesController {
    private static instance: LiquidacionesController;

    private constructor() { }

    public static getInstance(): LiquidacionesController {
        if (!LiquidacionesController.instance) {
            LiquidacionesController.instance = new LiquidacionesController();
        }
        return LiquidacionesController.instance;
    }

    public async getPendingItems(req: Request, res: Response) {
        const { obra_social_id } = req.query;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_liquidacion_items_pendientes', [
                obra_social_id ? Number(obra_social_id) : null
            ]);
            const rows = result.rows || [];
            // Filter out internal coverage (Vendedor)
            const filtered = rows.filter((item: any) => item.metodo !== 'OBRA_SOCIAL_VENDEDOR');
            res.json({ success: true, result: filtered });
        } catch (error) {
            console.error("Error getting pending items:", error);
            res.status(500).json({ success: false, error });
        }
    }

    public async save(req: Request, res: Response) {
        const { obra_social_id, fecha_desde, fecha_hasta, total, items } = req.body;

        if (!obra_social_id || !items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, error: "Datos incompletos" });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_liquidacion_crear', [
                obra_social_id,
                fecha_desde,
                fecha_hasta,
                total,
                JSON.stringify(items) // Array of IDs
            ]);
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.error("Error creating liquidation:", error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            // Fetch metadata
            const resultMeta = await PostgresDB.getInstance().callStoredProcedure('sp_liquidacion_get_by_id', [id]);
            const resultItems = await PostgresDB.getInstance().callStoredProcedure('sp_liquidacion_get_items', [id]);

            if (!resultMeta.rows || resultMeta.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Liquidación no encontrada' });
            }

            res.json({
                success: true,
                result: resultMeta.rows[0],
                items: resultItems.rows || []
            });
        } catch (error) {
            console.error("Error getting liquidation details:", error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getAll(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_liquidacion_listar');
            res.json({ success: true, result: result.rows || [] });
        } catch (error) {
            console.error("Error listing liquidations:", error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateStatus(req: Request, res: Response) {
        const { id } = req.params;
        const { estado } = req.body;

        if (!id || !estado) {
            return res.status(400).json({ success: false, error: "ID y estado requeridos" });
        }

        try {
            await PostgresDB.getInstance().callStoredProcedure('sp_liquidacion_cambiar_estado', [
                id,
                estado
            ]);
            res.json({ success: true });
        } catch (error) {
            console.error("Error updating liquidation status:", error);
            res.status(500).json({ success: false, error });
        }
    }
}

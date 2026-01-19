import { Request, Response } from 'express';
import { PostgresDB } from "../database/postgres";

export class CashController {
    private static instance: CashController;

    private constructor() { }

    public static getInstance(): CashController {
        if (!CashController.instance) {
            CashController.instance = new CashController();
        }
        return CashController.instance;
    }

    public async getClosingSummary(req: Request, res: Response) {
        try {
            const sucursal_id = req.user?.sucursal_id;

            if (!sucursal_id) {
                return res.status(400).json({ success: false, error: "Usuario sin sucursal asignada" });
            }

            const result = await PostgresDB.getInstance().callStoredProcedure(
                'sp_caja_obtener_resumen',
                [sucursal_id]
            );

            // The SP returns a single row with totals and a json of sales
            const data = result.rows[0];

            res.json({
                success: true,
                result: data
            });

        } catch (error: any) {
            console.error("Error getting cash summary:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async performClosing(req: Request, res: Response) {
        try {
            const sucursal_id = req.user?.sucursal_id;
            const usuario_id = req.user?.id;
            const { monto_real, observaciones } = req.body;

            if (!sucursal_id || !usuario_id) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            // Validar rol si es necesario (asumiendo que el middleware lo hace, pero doble check aquí si se requiere)
            // const userRole = req.user?.role;
            // if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') { ... }

            // Validate inputs
            if (monto_real === undefined || monto_real === null) {
                return res.status(400).json({ success: false, error: "Monto real es requerido" });
            }

            // 1. Fetch Dolar Rate for historical context
            let dolarContext = "";
            try {
                const configResult = await PostgresDB.getInstance().callStoredProcedure('sp_config_global_get', ['cotizacion_dolar']);
                const rate = configResult.rows[0]?.valor || 0;
                dolarContext = ` [Cotización USD: $${rate}]`;
            } catch (err) {
                console.warn("Could not fetch dolar rate for closing context:", err);
            }

            // Append context to observations
            const finalObservaciones = (observaciones || "") + dolarContext;

            // 2. Call SP to perform closing
            const result = await PostgresDB.getInstance().callStoredProcedure(
                'sp_caja_ejecutar_cierre',
                [
                    sucursal_id,
                    usuario_id,
                    monto_real,
                    finalObservaciones
                ]
            );

            res.json({
                success: true,
                result: result.rows[0]
            });

        } catch (error: any) {
            console.error("Error performing cash closing:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

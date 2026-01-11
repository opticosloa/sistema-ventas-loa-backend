import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';

// Definir interfaz para el arqueo si es necesario
interface CashierClosePayload {
    efectivo_real: number;
    mp_real: number;
    debito_real: number;
    credito_real: number;
    diferencia_total: number;
    observaciones: string;
}

export class CashierController {
    private static instance: CashierController;

    private constructor() { }

    public static getInstance(): CashierController {
        if (!CashierController.instance) {
            CashierController.instance = new CashierController();
        }
        return CashierController.instance;
    }

    // GET /api/cashier/stats
    public async getCashierStats(req: Request, res: Response) {
        try {
            // Asumimos que el middleware de auth coloca el usuario en req.user
            // El sucursal_id viene del usuario logueado
            const sucursal_id = req.user?.sucursal_id;

            if (!sucursal_id) {
                return res.status(400).json({ success: false, message: "Usuario no tiene sucursal asignada o no está logueado" });
            }

            const result = await PostgresDB.getInstance().callStoredProcedure(
                'sp_cierre_caja_get_stats',
                [sucursal_id]
            );

            // El SP debería devolver los montos acumulados por medio de pago para el turno actual
            // Podría devolver un objeto { efectivo: X, mp: Y, debito: Z, credito: W, fecha: ... }
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.error("Error getting cashier stats:", error);
            res.status(500).json({ success: false, error });
        }
    }

    // POST /api/cashier/close
    public async closeCashier(req: Request, res: Response) {
        try {
            const sucursal_id = req.user?.sucursal_id;
            const usuario_id = req.user?.id;

            if (!sucursal_id || !usuario_id) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const {
                efectivo_real,
                mp_real,
                debito_real,
                credito_real,
                diferencia_total,
                observaciones
            }: CashierClosePayload = req.body;

            // Parametros esperados por sp_cierre_caja_procesar:
            // sucursal_id, usuario_id, efectivo_real, mp_real, debito_real, credito_real, diferencia, observaciones
            const result = await PostgresDB.getInstance().callStoredProcedure(
                'sp_cierre_caja_procesar',
                [
                    sucursal_id,
                    usuario_id,
                    efectivo_real,
                    mp_real,
                    debito_real,
                    credito_real,
                    diferencia_total,
                    observaciones
                ]
            );

            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.error("Error closing cashier:", error);
            res.status(500).json({ success: false, error });
        }
    }
}

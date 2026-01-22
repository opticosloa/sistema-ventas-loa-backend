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
            // Updated to receive monto_remanente
            const { monto_real, observaciones, monto_remanente } = req.body;

            if (!sucursal_id || !usuario_id) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

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

            // 2. Call Updated SP
            const result = await PostgresDB.getInstance().callStoredProcedure(
                'sp_caja_ejecutar_cierre',
                [
                    sucursal_id,
                    usuario_id,
                    monto_real,
                    finalObservaciones,
                    monto_remanente || 0 // Default 0 if not provided
                ]
            );

            const closureData = result.rows[0];
            console.log(req.user);
            // 3. Generate PDF
            const { CashPdfService } = await import('../services/cash.pdf.service');
            const pdfBuffer = await CashPdfService.generateClosingReport({
                ...closureData,
                sucursal: req.user?.sucursal_nombre || 'Sucursal', // Assuming user object has name, or we fetch it.
                cajero: req.user?.username || 'Usuario', // Assuming user object has username
                fecha_apertura: closureData.o_fecha_apertura || new Date().toISOString(), // Adjust if SP outputs simplified names
                cierre_id: closureData.o_cierre_id,
                monto_sistema: closureData.o_monto_sistema,
                monto_real: monto_real,
                diferencia: closureData.o_diferencia,
                observaciones: finalObservaciones,
                monto_remanente: monto_remanente || 0,
                monto_extraccion: (Number(monto_real) - (Number(monto_remanente) || 0)),
                fecha_cierre: closureData.o_fecha_cierre,
                detalle_metodos: {} // Need to fetch detailed breakdown? SP stores it in 'detalle_metodos' column of table, but usually returns simplified.
                // Actually the SP returns only few columns. WE SHOULD UPDATE SP TO RETURN MORE DATA OR FETCH IT.
                // For now, let's rely on what SP returns. 
                // Wait, the SP inserts into DB. We can fetch the inserted row or update SP to return the json.
                // The updated SP returns: o_cierre_id, o_monto_sistema, o_diferencia, o_fecha_cierre.
                // Missing: detalle_metodos. 
                // I will Fetch the full closure record to be safe for the PDF.
            });

            // 3.5 Fetch full data for PDF (Robustness)
            const fullClosureResult = await PostgresDB.getInstance().executeQuery(
                `SELECT * FROM cierres_caja WHERE cierre_id = $1`,
                [closureData.o_cierre_id]
            );
            const fullData = fullClosureResult.rows[0];

            // Re-Generate with full data
            const finalPdfBuffer = await CashPdfService.generateClosingReport({
                ...fullData,
                sucursal: req.user?.sucursal_nombre || 'Sucursal',
                cajero: req.user?.username || 'Usuario'
            });


            // 4. Return PDF Stream
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Cierre_${closureData.o_cierre_id}.pdf`);
            res.send(finalPdfBuffer);

            // Note: Frontend should handle blob response.

        } catch (error: any) {
            console.error("Error performing cash closing:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

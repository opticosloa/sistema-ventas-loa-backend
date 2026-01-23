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

            // Recibimos los inputs del usuario y el total calculado
            const {
                monto_real,        // Total Global (Efectivo Físico + Otros Medios)
                observaciones,
                monto_remanente,   // Lo que queda en caja
                efectivo_fisico    // Billetes contados
            } = req.body;

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

            // 2. Call New SP (6 parameters)
            // p_sucursal_id, p_usuario_id, p_monto_real, p_observaciones, p_monto_remanente, p_efectivo_fisico
            const result = await PostgresDB.getInstance().callStoredProcedure(
                'sp_caja_ejecutar_cierre',
                [
                    sucursal_id,
                    usuario_id,
                    monto_real,
                    finalObservaciones,
                    monto_remanente || 0,
                    efectivo_fisico || 0
                ]
            );

            // The SP returns: o_cierre_id, o_monto_sistema, o_diferencia, o_fecha_cierre, o_fondo_inicial, o_diferencia_efectivo
            const spResult = result.rows[0];

            if (!spResult || !spResult.o_cierre_id) {
                throw new Error("El procedimiento almacenado no retornó un ID de cierre válido.");
            }

            // 3. Fetch Full Closure Data (Source of Truth for PDF)
            // Necesitamos 'detalle_metodos' y otros campos que el SP guardó en la tabla.
            const fullClosureQuery = await PostgresDB.getInstance().executeQuery(
                `SELECT * FROM cierres_caja WHERE cierre_id = $1`,
                [spResult.o_cierre_id]
            );
            const fullData = fullClosureQuery.rows[0];

            if (!fullData) {
                throw new Error("No se pudo recuperar el registro de cierre creado.");
            }

            // 4. Generate PDF
            const { CashPdfService } = await import('../service/cash.pdf.service');

            // Mapeamos los datos para el servicio de PDF
            // Usamos los valores retornados por el SP para las diferencias calculadas en el momento exacto

            // Construir detalle_metodos a partir de las columnas planas de la tabla (inferred from CashSummary)
            const detalle_metodos = {
                'EFECTIVO': Number(fullData.total_efectivo || 0),
                'ELECTRONICO': Number(fullData.total_electronico || 0),
                'OBRA SOCIAL': Number(fullData.total_obra_social || 0),
                // Add others if column exists, e.g. 'TARJETA': Number(fullData.total_tarjeta || 0)
            };

            const monto_extraccion = Number(efectivo_fisico || 0) - Number(monto_remanente || 0);

            const pdfBuffer = await CashPdfService.generateClosingReport({
                ...fullData, // Trae monto_sistema, monto_real, detalle_metodos, monto_extraccion, monto_remanente
                detalle_metodos, // Override with constructed object
                monto_extraccion,

                sucursal: req.user?.sucursal_nombre || 'Sucursal',
                cajero: req.user?.username || 'Usuario',

                // Sobrescribir/Asegurar campos especificos del reporte
                fecha_cierre: spResult.o_fecha_cierre,
                fondo_inicial: Number(spResult.o_fondo_inicial),

                // Diferencias calculadas por el SP
                diferencia_global: Number(spResult.o_diferencia),
                diferencia_efectivo: Number(spResult.o_diferencia_efectivo),

                // Inputs especificos
                efectivo_fisico: Number(efectivo_fisico || 0),

                // Obras Sociales (Liquidaciones Borrador)
                // El SP genera liquidaciones, podemos intentar recuperarlas o dejarlas vacias si no es critico listarlas DETALLADAMENTE en el pdf de caja
                // El requerimiento dice: "Listar las liquidaciones generadas en estado BORRADOR"
                // Consultamos las liquidaciones vinculadas a este cierre? 
                // El SP pone en observaciones de liquidacion: 'Generado automaticamente al Cierre de Caja ' || v_cierre_id
                // O podemos consultar por fecha y estado BORRADOR y user? 
                // Mejor: Consultar liquidaciones creadas en este 'instante' o usar un query especifico.
                // Dado que el SP no retorna los IDs de liquidaciones, haremos un query helper.
            });

            // 4.5 Fetch Liquidations for PDF (Optional improvement based on req)
            // El servicio PDF espera 'liquidaciones' en el objeto data si lo modificamos.
            // Vamos a hacerlo bien.
            const liquidacionesQuery = await PostgresDB.getInstance().executeQuery(
                `SELECT os.nombre as obra_social, l.total_declarado as total, l.estado 
                 FROM liquidaciones l
                 JOIN obras_sociales os ON l.obra_social_id = os.obra_social_id
                 WHERE l.observaciones LIKE $1`,
                [`%${spResult.o_cierre_id}%`]
            );

            // Regenerar PDF con liquidaciones si existen
            if (liquidacionesQuery.rows.length > 0) {
                const pdfBufferWithLiq = await CashPdfService.generateClosingReport({
                    ...fullData,
                    sucursal: req.user?.sucursal_nombre || 'Sucursal',
                    cajero: req.user?.username || 'Usuario',
                    fecha_cierre: spResult.o_fecha_cierre,
                    fondo_inicial: Number(spResult.o_fondo_inicial),
                    diferencia_global: Number(spResult.o_diferencia),
                    diferencia_efectivo: Number(spResult.o_diferencia_efectivo),
                    efectivo_fisico: Number(efectivo_fisico || 0),
                    liquidaciones: liquidacionesQuery.rows
                });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=Cierre_${spResult.o_cierre_id}.pdf`);
                res.send(pdfBufferWithLiq);
                return;
            }

            // Return PDF Stream (Sin liquidaciones extras si no hubo)
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Cierre_${spResult.o_cierre_id}.pdf`);
            res.send(pdfBuffer);

        } catch (error: any) {
            console.error("Error performing cash closing:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

import { Request, Response } from "express";
import { PostgresDB } from "../database/postgres";

export class CrystalsController {
    private static instance: CrystalsController;

    private constructor() { }

    public static getInstance(): CrystalsController {
        if (!CrystalsController.instance) {
            CrystalsController.instance = new CrystalsController();
        }
        return CrystalsController.instance;
    }

    public async createBatchCristales(req: Request, res: Response) {
        try {
            const {
                material,
                tratamiento,
                esfera_min,
                esfera_max,
                cilindro_min,
                cilindro_max,
                precio_usd,
                stock_inicial
            } = req.body;

            // Validación básica
            if (!material || !tratamiento) {
                return res.status(400).json({ error: 'Material y Tratamiento son obligatorios' });
            }

            // Llamada al SP sp_cristales_upsert_rango
            // Nota: El orden de los parámetros debe coincidir EXACTAMENTE con el del SP SQL
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_cristales_upsert_rango', [
                material,
                tratamiento,
                Number(esfera_min),
                Number(esfera_max),
                Number(cilindro_min),
                Number(cilindro_max),
                Number(precio_usd),
                Number(stock_inicial || 0),
                null // ubicacion (opcional, enviamos null por defecto)
            ]);

            // El SP devuelve un entero (v_contador)
            const createdCount = result.rows?.[0]?.sp_cristales_upsert_rango;

            return res.json({
                success: true,
                message: `Se procesaron ${createdCount} cristales correctamente.`,
                count: createdCount
            });

        } catch (error) {
            console.error("Error en createBatchCristales:", error);
            return res.status(500).json({ error: 'Error interno procesando la matriz de cristales' });
        }
    }

    public async checkStock(req: Request, res: Response) {
        const { esfera, cilindro, material, tratamiento } = req.query;

        // Validation
        if (esfera === undefined || cilindro === undefined) {
            return res.status(400).json({ success: false, message: "Esfera and Cilindro required" });
        }

        try {
            // Flexible match for material/treatment which might be partial or ID-based in future.
            // For now, exact match string.

            // Handle numeric precision? 
            // e.g. -2.00 vs -2. 
            // Postgres numeric comparison should handle it if types are numeric.

            // Ensure numeric types for SP
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_verificar', [
                Number(esfera),
                Number(cilindro),
                material,
                tratamiento
            ]);

            if (result.rows.length > 0) {
                res.json({ success: true, result: result.rows[0] });
            } else {
                res.json({ success: true, result: null });
            }

        } catch (error) {
            console.error("Error checking crystal stock:", error);
            res.status(500).json({ success: false, error });
        }
    }

    public async searchRange(req: Request, res: Response) {
        const { esferaFrom, esferaTo, cilindroFrom, cilindroTo, material } = req.query;

        try {
            // Llamada al nuevo Stored Procedure
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_listar_rango', [
                esferaFrom || '',
                esferaTo || '',
                cilindroFrom || '',
                cilindroTo || '',
                material || 'ALL'
            ]);

            res.json({
                success: true,
                result: result.rows
            });

        } catch (error: any) {
            console.error("❌ ERROR DETALLADO:", error.message, error.stack);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async deductStock(esfera: string, cilindro: string, material: string, tratamiento: string, cantidad: number = 1) {
        try {
            // Check if exists first? Or direct update?
            // "UPDATE cristales_stock SET stock = stock - qty WHERE ..."
            // We need to ensure stock >= qty or allow negative/warning?
            // User requirement: "Descontar 1 unidad"

            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_descontar', [
                esfera,
                cilindro,
                material,
                tratamiento,
                cantidad
            ]);

            // SP should return true/false or updated row. 
            // Assuming it returns a boolean 'success' or the updated row if successful.
            // If it returns a set of rows, length > 0 means success.
            return result.rows.length > 0;

        } catch (error) {
            console.error("Error deducting stock:", error);
            return false;
        }
    }

    // Endpoint para usar en el Punto de Venta (POS)
    public async getPriceForSale(req: Request, res: Response) {
        const { esfera, cilindro, material, tratamiento } = req.query;

        if (!esfera || !cilindro) {
            return res.status(400).json({ error: 'Esfera y Cilindro requeridos' });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_buscar_dinamico', [
                Number(esfera),
                Number(cilindro),
                material ? String(material) : null,
                tratamiento ? String(tratamiento) : null
            ]);

            // Devolvemos el primer match con el precio ya calculado en pesos
            return res.json({
                success: true,
                result: result.rows
            });

        } catch (error) {
            console.error("Error buscando precio dinámico:", error);
            return res.status(500).json({ error: 'Error calculando precio' });
        }
    }
}

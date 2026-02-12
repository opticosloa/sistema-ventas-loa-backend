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
                precio_costo,
                p_sucursales_data // Expecting JSON array
            } = req.body;

            // Validación básica
            if (!material || !tratamiento) {
                return res.status(400).json({ error: 'Material y Tratamiento son obligatorios' });
            }

            // Llamada al SP sp_cristales_upsert_rango
            // New Signature: p_material, p_tratamiento, p_esfera_min, p_esfera_max, p_cilindro_min, p_cilindro_max, p_precio_usd, p_precio_costo, p_sucursales_data
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_cristales_upsert_rango', [
                material,
                tratamiento,
                Number(esfera_min),
                Number(esfera_max),
                Number(cilindro_min),
                Number(cilindro_max),
                Number(precio_usd),
                Number(precio_costo || 0),
                JSON.stringify(p_sucursales_data || [])
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
        const { esfera, cilindro, material, tratamiento, sucursal_id } = req.query;

        // Validation
        if (esfera === undefined || cilindro === undefined || !sucursal_id) {
            return res.status(400).json({ success: false, message: "Esfera, Cilindro and Sucursal ID required" });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_verificar', [
                Number(esfera),
                Number(cilindro),
                material,
                tratamiento,
                String(sucursal_id)
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

    public async checkGlobalStock(req: Request, res: Response) {
        const { esfera, cilindro, material, tratamiento } = req.query;

        if (esfera === undefined || cilindro === undefined) {
            return res.status(400).json({ success: false, message: "Esfera and Cilindro required" });
        }

        try {
            // Calls sp_cristal_stock_global
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_global', [
                Number(esfera),
                Number(cilindro),
                material,
                tratamiento
            ]);

            return res.json({
                success: true,
                result: result.rows || []
            });

        } catch (error) {
            console.error("Error checking global crystal stock:", error);
            return res.status(500).json({ success: false, error: 'Error checking global stock' });
        }
    }

    public async searchRange(req: Request, res: Response) {
        const { esferaFrom, esferaTo, cilindroFrom, cilindroTo, material, sucursal_id } = req.query;

        try {
            // Llamada al nuevo Stored Procedure
            // sp_cristal_stock_listar_rango(p_esfera_from, p_esfera_to, p_cilindro_from, p_cilindro_to, p_material, p_sucursal_id)
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_listar_rango', [
                esferaFrom || '',
                esferaTo || '',
                cilindroFrom || '',
                cilindroTo || '',
                material || 'ALL',
                sucursal_id ? String(sucursal_id) : null // Nuevo parámetro
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

    public async getStockDetails(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_consultar_distribucion', [id]);
            res.json({ success: true, result: result.rows });
        } catch (error: any) {
            console.error("Error getting crystal stock details:", error);
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
    public async searchCrystals(req: Request, res: Response) {
        try {
            const { q } = req.query;

            if (!q || typeof q !== 'string') {
                return res.json({ success: true, result: [] });
            }

            // Llamada al SP con el término de búsqueda
            // Asumimos que el SP ha sido adaptado para aceptar un solo parámetro de texto 'q' para búsqueda general
            // Si el SP original requería 4 parámetros, esto podría fallar si no se actualizó en BD.
            // Siguiendo instrucciones explícitas del usuario: calls sp_cristal_buscar_dinamico
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_buscar_dinamico', [q]);

            return res.json({
                success: true,
                result: result.rows
            });

        } catch (error) {
            console.error('Error searching crystals:', error);
            return res.status(500).json({
                success: false,
                message: 'Error searching crystals'
            });
        }
    }

    public async updatePricesSelectively(req: Request, res: Response) {
        try {
            const { material, tratamiento, porcentaje } = req.body;

            if (porcentaje === undefined) {
                return res.status(400).json({ success: false, error: 'Porcentaje is required' });
            }

            // Call SP with material, treatment (which can be 'ALL' or specific) and percentage
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_stock_actualizar_precios_selectivo', [
                material || 'ALL',
                tratamiento || 'ALL',
                porcentaje
            ]);

            res.json({ success: true, result });

        } catch (error) {
            console.error('Error updating crystal prices:', error);
            res.status(500).json({ success: false, error: 'Error updating crystal prices' });
        }
    }
}

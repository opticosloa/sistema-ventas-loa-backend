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
    public async createCrystal(req: Request, res: Response) {
        const { material, tratamiento, esfera, cilindro, stock, stock_minimo, ubicacion, precio_costo, precio_venta } = req.body;

        try {
            // Basic validation
            if (!material || !tratamiento || esfera === undefined || cilindro === undefined) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }

            // Check if exists? Unique constraint?
            // Assuming (esfera, cilindro, material, tratamiento) is unique key.
            // If exists, maybe update stock? Or error?
            // "Batalla Naval" style implies uniqueness.
            // Let's try insert, if error (conflict), return error.

            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cristal_crear', [
                material,
                tratamiento,
                Number(esfera),
                Number(cilindro),
                stock || 0,
                stock_minimo || 0,
                ubicacion,
                precio_costo || 0,
                precio_venta || 0
            ]);

            res.status(201).json({ success: true, result: result.rows[0] });

        } catch (error: any) {
            console.error("❌ ERROR DETALLADO:", error.message, error.stack);
            res.status(500).json({ success: false, error: error.message, detail: error.detail });
        }
    }
}

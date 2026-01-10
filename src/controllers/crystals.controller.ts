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

            const result = await PostgresDB.getInstance().executeQuery(
                `SELECT * FROM cristales_stock 
                 WHERE esfera = $1 
                   AND cilindro = $2 
                   AND material = $3 
                   AND tratamiento = $4`,
                [esfera, cilindro, material, tratamiento]
            );

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
            // Construimos una consulta dinámica simple
            // Usamos COALESCE o comparaciones directas para manejar filtros opcionales
            const query = `
            SELECT * FROM cristales_stock 
            WHERE 
                ($1::text = '' OR esfera >= $1::numeric) AND
                ($2::text = '' OR esfera <= $2::numeric) AND
                ($3::text = '' OR cilindro >= $3::numeric) AND
                ($4::text = '' OR cilindro <= $4::numeric) AND
                ($5::text = 'ALL' OR material = $5)
            ORDER BY esfera DESC, cilindro DESC
        `;

            const values = [
                esferaFrom || '',
                esferaTo || '',
                cilindroFrom || '',
                cilindroTo || '',
                material || 'ALL'
            ];

            const result = await PostgresDB.getInstance().executeQuery(query, values);

            res.json({
                success: true,
                result: result.rows
            });

        } catch (error) {
            console.error("Error searching crystal range:", error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deductStock(esfera: string, cilindro: string, material: string, tratamiento: string, cantidad: number = 1) {
        try {
            // Check if exists first? Or direct update?
            // "UPDATE cristales_stock SET stock = stock - qty WHERE ..."
            // We need to ensure stock >= qty or allow negative/warning?
            // User requirement: "Descontar 1 unidad"

            const result = await PostgresDB.getInstance().executeQuery(
                `UPDATE cristales_stock 
                 SET stock = stock - $1 
                 WHERE esfera = $2 
                   AND cilindro = $3 
                   AND material = $4 
                   AND tratamiento = $5
                   AND stock >= $1
                 RETURNING stock`,
                [cantidad, esfera, cilindro, material, tratamiento]
            );

            return result.rows.length > 0;

        } catch (error) {
            console.error("Error deducting stock:", error);
            return false;
        }
    }
}

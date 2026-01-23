import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import { ObraSocial } from '../types/obrasSociales';
import { ObrasSocialesService } from '../service/obras_sociales.service';


export class ObrasSocialesController {
    private static instance: ObrasSocialesController;

    private constructor() { }

    public static getInstance(): ObrasSocialesController {
        if (!ObrasSocialesController.instance) {
            ObrasSocialesController.instance = new ObrasSocialesController();
        }
        return ObrasSocialesController.instance;
    }

    public async getAll(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_listar');
            res.json({ success: true, result: result.rows });
        } catch (error: any) {
            console.error("Error getting Obras Sociales:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getObraSocialById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_get_by_id', [id]);
            if (result.rows.length > 0) {
                res.json({ success: true, result: result.rows[0] });
            } else {
                res.status(404).json({ success: false, message: 'Obra Social not found' });
            }
        } catch (error: any) {
            console.error("Error getting Obra Social:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async upsert(req: Request, res: Response) {
        // Extraemos los datos del body
        const data = req.body;

        if (!data.nombre) {
            return res.status(400).json({ success: false, error: "Nombre es requerido" });
        }

        try {
            // Construimos el objeto asegurando tipos y valores por defecto
            const payload: ObraSocial = {
                obra_social_id: data.obra_social_id || undefined, // Si viene vacío, que sea undefined
                nombre: data.nombre,
                plan: data.plan || '',
                sitio_web: data.sitio_web || '',
                instrucciones: data.instrucciones || '',
                activo: data.activo !== undefined ? data.activo : true,
                cobertura: data.cobertura || { porcentaje_cristales: 0, porcentaje_armazones: 0 },
                monto_cobertura_total: Number(data.monto_cobertura_total) || 0,
                cobertura_armazon_max: Number(data.cobertura_armazon_max) || 0,
                cobertura_cristal_max: Number(data.cobertura_cristal_max) || 0,
            };

            const result = await ObrasSocialesService.getInstance().upsert(payload);

            res.json({ success: true, result });
        } catch (error: any) {
            console.error("Error upserting Obra Social:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async searchObrasSociales(req: Request, res: Response) {
        const { q } = req.params; // Changed from req.query to match route definition /search/:q or keeping /search/q convention
        // Route plan said: GET /search/q. Let's assume URL param for simplicity or query param. 
        // User request: "GET /search/q". Usually this implies /search/:q  OR /search?q=...
        // PROVIDERS uses /search?q=... let's check routes file update next. 
        // Instructions said: "GET /search/q". Be careful. It could be a typo for /search?q or /search/:q. 
        // I will implement as /search/:q in routes to match the explicit instruction "/search/q", 
        // but typically "q" is a query param.
        // Let's stick to params based on instruction "GET /search/q" - literally q is the param name often.
        // Wait, providers uses `req.query`. I should probably standardise.
        // But user said: "GET /search/q". I will interpret "q" as a parameter.

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_buscar', [q]);
            res.json({ success: true, result: result.rows });
        } catch (error: any) {
            console.error("Error searching Obras Sociales:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async deleteObraSocial(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_eliminar', [id]);
            res.json({ success: true, result: result.rows[0] });
        } catch (error: any) {
            console.error("Error deleting Obra Social:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

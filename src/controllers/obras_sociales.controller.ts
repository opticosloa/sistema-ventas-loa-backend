import { Request, Response } from 'express';
import { ObrasSocialesService, ObraSocial } from '../service/obras_sociales.service';

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
            const result = await ObrasSocialesService.getInstance().getAll();
            res.json({ success: true, result });
        } catch (error: any) {
            console.error("Error getting Obras Sociales:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async upsert(req: Request, res: Response) {
        // Expecting body: { obra_social_id?, nombre, sitio_web?, instrucciones?, activo }
        const data: ObraSocial = req.body;

        if (!data.nombre) {
            return res.status(400).json({ success: false, error: "Nombre es requerido" });
        }

        try {
            const result = await ObrasSocialesService.getInstance().upsert(data);
            res.json({ success: true, result });
        } catch (error: any) {
            console.error("Error upserting Obra Social:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

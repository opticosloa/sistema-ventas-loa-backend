import { Request, Response } from "express";
import { MultifocalesService } from "../services/multifocales.service";

export class MultifocalesController {
    private static instance: MultifocalesController;
    private service: MultifocalesService;

    private constructor() {
        this.service = MultifocalesService.getInstance();
    }

    public static getInstance(): MultifocalesController {
        if (!MultifocalesController.instance) {
            MultifocalesController.instance = new MultifocalesController();
        }
        return MultifocalesController.instance;
    }

    public async search(req: Request, res: Response) {
        try {
            const { q } = req.query;
            const result = await this.service.search(q as string);
            return res.json({
                success: true,
                result: result
            });
        } catch (error: any) {
            console.error("Error searching multifocales:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    public async upsert(req: Request, res: Response) {
        try {
            const data = req.body;
            // Validaciones básicas podrían ir aquí
            if (!data.marca || !data.modelo || !data.precio) {
                return res.status(400).json({ success: false, error: "Datos incompletos" });
            }

            const result = await this.service.upsert(data);
            return res.json({
                success: true,
                result: result,
                message: "Multifocal guardado correctamente"
            });
        } catch (error: any) {
            console.error("Error saving multifocal:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}

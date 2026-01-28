import { Request, Response } from "express";
import { MultifocalesService } from "../service";

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
    // --- MARCAS ---
    public async getBrands(req: Request, res: Response) {
        try {
            const result = await this.service.getBrands();
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async createBrand(req: Request, res: Response) {
        try {
            const { nombre } = req.body;
            const result = await this.service.createBrand(nombre);
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async updateBrand(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { nombre, activo } = req.body;

            if (!id) return res.status(400).json({ success: false, error: "ID es requerido" });

            const result = await this.service.updateBrand(id, nombre, activo);
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- MODELOS ---
    public async getModels(req: Request, res: Response) {
        try {
            const { marca_id } = req.query;
            const result = await this.service.getModels(marca_id ? String(marca_id) : undefined);
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async createModel(req: Request, res: Response) {
        try {
            const { marca_id, nombre } = req.body;
            // Ensure marca_id is treated as string if it might be undefined in type defs, though req.body is usually any. 
            // If explicit type issues:
            const result = await this.service.createModel(String(marca_id), nombre);
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async updateModel(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { nombre, activo } = req.body;

            if (!id) return res.status(400).json({ success: false, error: "ID es requerido" });

            const result = await this.service.updateModel(id, nombre, activo);
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

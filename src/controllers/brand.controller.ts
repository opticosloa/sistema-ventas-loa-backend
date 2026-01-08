import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';


import { Brand } from "../types/brand";

export class BrandController {
    private static instance: BrandController;

    private constructor() { }

    public static getInstance(): BrandController {
        if (!BrandController.instance) {
            BrandController.instance = new BrandController();
        }
        return BrandController.instance;
    }

    public async createBrand(req: Request, res: Response) {
        const { nombre, proveedor_id }: Brand = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_marca_crear', [nombre, proveedor_id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateBrand(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, proveedor_id }: Brand = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_marca_update', [id, nombre, proveedor_id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getBrands(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_marca_get');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getBrandById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_marca_get_by_id', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteBrand(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_marca_delete', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }
}

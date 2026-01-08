import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';

import { Services } from "../types/services";

export class ServicesController {
    private static instance: ServicesController;

    private constructor() { }

    public static getInstance(): ServicesController {
        if (!ServicesController.instance) {
            ServicesController.instance = new ServicesController();
        }
        return ServicesController.instance;
    }

    public async createService(req: Request, res: Response) {
        const { nombre, descripcion, precio_costo, precio_venta, iva }: Services = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_servicio_crear', [
                nombre,
                descripcion,
                precio_costo,
                precio_venta,
                iva
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getServices(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_servicio_listar');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getServiceById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_servicio_get_by_id', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateService(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, descripcion, precio_costo, precio_venta, iva }: Services = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_servicio_editar', [
                id,
                nombre,
                descripcion,
                precio_costo,
                precio_venta,
                iva
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteService(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_servicio_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }
}

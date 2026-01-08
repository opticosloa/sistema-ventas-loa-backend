import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import { Sucursal } from '../types/sucursal';

export class TenantsController {
    private static instance: TenantsController;

    private constructor() { }

    public static getInstance(): TenantsController {
        if (!TenantsController.instance) {
            TenantsController.instance = new TenantsController();
        }
        return TenantsController.instance;
    }

    public async createTenant(req: Request, res: Response) {
        const { nombre, encargado, direccion, telefono, email, is_active }: Sucursal = req.body;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_crear', [
                nombre,
                encargado,
                direccion,
                telefono,
                email,
                is_active ?? true
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getTenants(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_get');
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getTenantById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_get_by_id', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateTenant(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, encargado, direccion, telefono, email, is_active }: Sucursal = req.body;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_editar', [
                id,
                nombre,
                encargado,
                direccion,
                telefono,
                email,
                is_active
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteTenant(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async searchTenantByName(req: Request, res: Response) {
        const { nombre } = req.params;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_buscar_by_nombre', [nombre]);

            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

}

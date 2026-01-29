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
        const { nombre, encargado, direccion, telefono, email, mp_public_key, mp_access_token }: Sucursal = req.body;

        try {
            // SP Signature: p_nombre, p_encargado, p_direccion, p_telefono, p_email, p_mp_public_key, p_mp_access_token
            // Note: is_active is NOT in the provided SP for create. Encargado is UUID.
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_crear', [
                nombre,
                encargado || null, // Ensure empty string becomes null for UUID safety
                direccion,
                telefono,
                email,
                mp_public_key || null,
                mp_access_token || null
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
        const { nombre, encargado, direccion, telefono, email, is_active, mp_public_key, mp_access_token }: Sucursal = req.body;

        try {
            // SP Signature provided by user: p_sucursal_id, p_nombre, p_encargado, p_direccion, p_telefono, p_email, p_is_active
            // WARNING: The provided SP does NOT accept mp_public_key or mp_access_token.
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_editar', [
                id,
                nombre,
                encargado || null,
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

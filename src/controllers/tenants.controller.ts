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
        const { nombre, encargado, direccion, telefono, email, mp_public_key, mp_access_token, mp_user_id }: Sucursal = req.body;

        try {
            // SP Signature: p_nombre, p_encargado, p_direccion, p_telefono, p_email, p_mp_public_key, p_mp_access_token, p_mp_user_id
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_crear', [
                nombre,
                encargado || null,
                direccion,
                telefono,
                email,
                mp_public_key || null,
                mp_access_token || null,
                mp_user_id || null
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
        const { nombre, encargado, direccion, telefono, email, is_active, mp_public_key, mp_access_token, color_identificativo, mp_user_id }: Sucursal = req.body;

        try {
            // SP Signature: p_sucursal_id, p_nombre, p_encargado, p_direccion, p_telefono, p_email, p_is_active, p_mp_public_key, p_mp_access_token, p_color_identificativo, p_mp_user_id
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_sucursal_editar', [
                id,
                nombre,
                encargado || null,
                direccion,
                telefono,
                email,
                is_active,
                mp_public_key || null,
                mp_access_token || null,
                color_identificativo,
                mp_user_id || null
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async changeUserBranch(req: Request, res: Response) {
        const { usuario_id, nueva_sucursal_id } = req.body;
        // p_admin_id should come from the logged in user (req.user.id or similar)
        // Assuming authMiddleware populates req.user
        const admin_id = (req as any).user?.uid || (req as any).user?.usuario_id;

        if (!usuario_id || !nueva_sucursal_id) {
            return res.status(400).json({ success: false, error: 'Missing usuario_id or nueva_sucursal_id' });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_cambiar_sucursal', [
                usuario_id,
                nueva_sucursal_id,
                admin_id || null // Audit
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

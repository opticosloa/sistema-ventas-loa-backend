import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import { Proveedor } from '../types/proveedor';

export class ProvidersController {
    private static instance: ProvidersController;

    private constructor() { }

    public static getInstance(): ProvidersController {
        if (!ProvidersController.instance) {
            ProvidersController.instance = new ProvidersController();
        }
        return ProvidersController.instance;
    }

    public async getProviders(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_proveedor_get');
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error retrieving providers' });
        }
    }

    public async getProviderById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_proveedor_get_by_id', [id]);
            if (result.rows.length > 0) {
                res.json({ success: true, result: result.rows[0] });
            } else {
                res.status(404).json({ success: false, message: 'Provider not found' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error retrieving provider' });
        }
    }

    public async createProvider(req: Request, res: Response) {
        const { nombre, telefono, cuit, iva, contacto, condiciones }: Proveedor = req.body;

        if (!nombre) {
            return res.status(400).json({ success: false, message: 'Nombre is required' });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_proveedor_crear', [
                nombre,
                telefono || null,
                cuit || null,
                iva || null,
                contacto || null,
                condiciones || null
            ]);
            res.status(201).json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error creating provider' });
        }
    }

    public async updateProvider(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, telefono, cuit, iva, contacto, condiciones }: Proveedor = req.body;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_proveedor_update', [
                id,
                nombre,
                telefono || null,
                cuit || null,
                iva || null,
                contacto || null,
                condiciones || null
            ]);
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error updating provider' });
        }
    }

    public async deleteProvider(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_proveedor_delete', [id]);
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error deleting provider' });
        }
    }

    public async searchProviders(req: Request, res: Response) {
        const { q } = req.query;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_proveedor_get_by_nombre', [q]);
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error searching providers' });
        }
    }
}

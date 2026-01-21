import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';

import { Client } from "../types/client";

export class ClientsController {
    private static instance: ClientsController;

    private constructor() { }

    public static getInstance(): ClientsController {
        if (!ClientsController.instance) {
            ClientsController.instance = new ClientsController();
        }
        return ClientsController.instance;
    }

    public async createClient(req: Request, res: Response) {
        const { nombre, apellido, telefono, email, dni, direccion, fecha_nacimiento, cuenta_corriente }: Client = req.body;
        const capitalize = (str: string) => (str || "").toLowerCase().replace(/(^|[\s-])(\S)/g, (match, sep, char) => sep + char.toUpperCase());
        const nombreUpper = capitalize(nombre);
        const apellidoUpper = capitalize(apellido);
        let direccionUpper = null;
        if (direccion) {
            direccionUpper = capitalize(direccion);
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_crear', [
                nombreUpper,
                apellidoUpper,
                telefono,
                email,
                dni,
                direccionUpper,
                fecha_nacimiento,
                cuenta_corriente
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getClients(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_listar');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getClientById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_get_by_id', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateClient(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, apellido, telefono, email, dni, direccion, fecha_nacimiento, cuenta_corriente }: Client = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_editar', [
                id,
                nombre,
                apellido,
                telefono,
                email,
                dni,
                direccion,
                fecha_nacimiento,
                cuenta_corriente
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteClient(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getClientByDNI(req: Request, res: Response) {
        const { dni } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_get_by_dni', [dni]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getAccountStatus(req: Request, res: Response) {
        const { id } = req.params;
        try {
            // Reusing sp_cliente_get_by_id which likely returns fields including cuenta_corriente
            // If we need a dedicated lightweight SP, we can create one, but this is efficient enough.
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_cliente_get_by_id', [id]);

            // Check if result is empty
            if (!result.rows || result.rows.length === 0) {
                // Return 0 if client not found or no account info (safer default)
                return res.json({ success: true, result: { cuenta_corriente: 0 } });
            }

            const client = result.rows[0];
            res.json({
                success: true,
                result: {
                    cuenta_corriente: Number(client.cuenta_corriente || 0)
                }
            });
        } catch (error) {
            console.error("Error fetching account status:", error);
            res.status(500).json({ success: false, error });
        }
    }
}

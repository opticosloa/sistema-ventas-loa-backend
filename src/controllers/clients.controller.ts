import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
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


    public async adjustBalance(req: Request, res: Response) {
        const { id: cliente_id } = req.params;
        const usuario_solicitante_id = req.user?.id; // Verifica si tu payload usa 'id' o 'uid'
        const { nuevo_saldo, motivo, autorizador_id, pin_autorizador } = req.body;

        // 1. Validaciones básicas
        if (!usuario_solicitante_id) {
            return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        }

        if (!autorizador_id || !pin_autorizador) {
            return res.status(400).json({ success: false, message: "Faltan datos de autorización (Supervisor y PIN)." });
        }

        // 2. Doble control: No puede ser el mismo usuario
        if (usuario_solicitante_id === autorizador_id) {
            return res.status(403).json({ success: false, message: "Doble control requerido: No puedes auto-autorizarte." });
        }

        try {
            const db = PostgresDB.getInstance();

            // 3. Buscar al autorizador para obtener su hash del PIN
            const userResult = await db.executeQuery(
                'SELECT security_pin, rol FROM usuarios WHERE usuario_id = $1 AND is_active = true',
                [autorizador_id]
            );

            if (userResult.rowCount === 0) {
                return res.status(404).json({ success: false, message: "Supervisor no encontrado o inactivo." });
            }

            const supervisor = userResult.rows[0];

            // 4. Validar que el autorizador tenga el rol necesario
            if (!['ADMIN', 'SUPERADMIN'].includes(supervisor.rol)) {
                return res.status(403).json({ success: false, message: "El usuario seleccionado no tiene permisos de supervisor." });
            }

            // 5. Comparar el PIN usando bcrypt
            const isPinValid = await bcrypt.compare(pin_autorizador, supervisor.security_pin);
            if (!isPinValid) {
                return res.status(401).json({ success: false, message: "PIN de autorización incorrecto." });
            }

            // 6. Si todo está OK, llamar al Stored Procedure con los IDs
            const result = await db.callStoredProcedure('sp_cliente_editar_cuenta_corriente', [
                cliente_id,
                usuario_solicitante_id,
                autorizador_id,
                nuevo_saldo,
                motivo
            ]);

            const response = result.rows[0].sp_cliente_editar_cuenta_corriente || result.rows[0];
            res.json(response);

        } catch (error) {
            console.error("Error adjusting balance:", error);
            res.status(500).json({ success: false, error: "Error interno del servidor." });
        }
    }
}

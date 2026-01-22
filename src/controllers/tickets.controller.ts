import type { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';

export class TicketsController {
    private static instance: TicketsController;

    private constructor() { }

    public static getInstance(): TicketsController {
        if (!TicketsController.instance) {
            TicketsController.instance = new TicketsController();
        }
        return TicketsController.instance;
    }

    public async createTicket(req: Request, res: Response) {
        // Recibe: venta_id, cliente_id, usuario_id, fecha_entrega_estimada, notas.
        const { venta_id, cliente_id, usuario_id, fecha_entrega_estimada, notas } = req.body;

        if (!venta_id || !cliente_id) {
            return res.status(400).json({ success: false, error: 'Faltan datos obligatorios (venta_id, cliente_id)' });
        }

        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_crear', [
                venta_id,
                cliente_id,
                usuario_id, // Empleado que crea el ticket
                fecha_entrega_estimada,
                notas || ''
            ]);

            const row = result.rows ? result.rows[0] : (Array.isArray(result) ? result[0] : result);
            const ticketId = row?.ticket_id || row?.sp_ticket_crear;

            // AUTO-SET a 'LISTO' (Requerimiento especial)
            if (ticketId) {
                await PostgresDB.getInstance().callStoredProcedure('sp_ticket_cambiar_estado', [
                    ticketId,
                    'LISTO',
                    'Estado inicial automático'
                ]);
            }

            res.status(201).json({ success: true, result: result.rows ? result.rows[0] : result });
        } catch (error: any) {
            console.error('Error creating ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getTickets(req: Request, res: Response) {
        // Query params: sucursal_id (opcional para admin), estado (opcional), search (opcional)
        const { sucursal_id, estado, search } = req.query;
        const user = req.user;

        try {
            let filterSucursalId: string | null = null;

            filterSucursalId = null;

            /* Lógica anterior comentada por requerimiento:
            const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';
            
            if (isAdmin) {
                // Si es admin, usa el query param si existe, sino null (todas)
                filterSucursalId = (sucursal_id as string) || null;
            } else {
                // Si no es admin, fuerza su sucursal
                filterSucursalId = user?.sucursal_id || null;
            }
            */

            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_listar', [
                filterSucursalId,
                estado || null,
                search || null
            ]);

            res.json({ success: true, result: result.rows || result });
        } catch (error: any) {
            console.error('Error fetching tickets:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async updateStatus(req: Request, res: Response) {
        const { id } = req.params;
        const { estado, notas } = req.body;
        const user = req.user; // Assumes middleware populates this

        // Validación Admin para CANCELADO
        if (estado === 'CANCELADO') {
            // Check role or is_admin flag. Assuming 'role' exists on token/user object.
            // If user object structure is different (e.g. rol), adjust here.
            // Based on previous contexts, role is likely 'ADMIN' or 'SUPERADMIN'.
            // En tickets.controller.ts -> updateStatus
            const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';

            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Solo administradores pueden cancelar tickets' });
            }
        }

        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_cambiar_estado', [
                id,
                estado,
                notas || ''
            ]);
            res.json({ success: true, result: result.rows ? result.rows[0] : result });
        } catch (error: any) {
            console.error('Error updating ticket status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async deliverTicket(req: Request, res: Response) {
        const { id } = req.params;
        const { usuario_id } = req.body; // Empleado que entrega

        if (!usuario_id) {
            return res.status(400).json({ success: false, error: 'usuario_id (despachante) es requerido' });
        }

        try {
            // sp_ticket_entregar updates status to 'ENTREGADO' and sets ventas.despachante_id
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_entregar', [
                id,
                usuario_id
            ]);
            res.json({ success: true, result: result.rows ? result.rows[0] : result });
        } catch (error: any) {
            console.error('Error delivering ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getTicketById(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_get_by_id', [id]);

            // Verificamos si el SP devolvió filas
            const ticket = result.rows ? result.rows[0] : (result[0] || null);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    error: 'No se encontró el ticket solicitado'
                });
            }

            res.json({
                success: true,
                result: ticket
            });
        } catch (error: any) {
            console.error('Error fetching ticket by ID:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}
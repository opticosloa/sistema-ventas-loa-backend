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
            res.status(201).json({ success: true, result: result.rows ? result.rows[0] : result });
        } catch (error: any) {
            console.error('Error creating ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getTickets(req: Request, res: Response) {
        // Query params: sucursal_id (obligatorio), estado (opcional), search (opcional)
        const { sucursal_id, estado, search } = req.query;

        if (!sucursal_id) {
            return res.status(400).json({ success: false, error: 'sucursal_id es requerido' });
        }

        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_listar', [
                sucursal_id,
                estado || null,
                search || null
            ]);
            // sp_ticket_listar returns a table
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
}
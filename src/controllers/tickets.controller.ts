import type { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import { Ticket } from "../types/tickets";

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
        const { venta_id, cliente_id, usuario_id, fecha_entrega_estimada, estado, notas }: Ticket = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_crear', [
                venta_id,
                cliente_id,
                usuario_id,
                fecha_entrega_estimada,
                estado,
                notas
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getTickets(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_get');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateTicket(req: Request, res: Response) {
        const { id } = req.params;
        const { venta_id, cliente_id, usuario_id, fecha_entrega_estimada, fecha_entrega_real, estado, notas }: Ticket = req.body;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_editar', [
                id,
                venta_id,
                cliente_id,
                usuario_id,
                fecha_entrega_estimada,
                fecha_entrega_real,
                estado,
                notas
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getTicketById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_get_by_id', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteTicket(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_ticket_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async entregarTicket(req: Request, res: Response) {
        const { id } = req.params;
        const empleado_id = req.user?.id;

        if (!empleado_id) {
            return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        }

        try {
            await PostgresDB.getInstance().callStoredProcedure(
                'sp_ticket_entregar',
                [id, empleado_id]
            );

            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

}
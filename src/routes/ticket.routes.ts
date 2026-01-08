import { Router } from "express";
import { TicketsController } from "../controllers/tickets.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = TicketsController.getInstance();

router.post('/', authMiddleware, controller.createTicket.bind(controller));
router.get('/', authMiddleware, controller.getTickets.bind(controller));
router.get('/:id', authMiddleware, controller.getTicketById.bind(controller));
router.put('/:id', authMiddleware, controller.updateTicket.bind(controller));
router.delete('/:id', authMiddleware, controller.deleteTicket.bind(controller));
router.post('/:id/entregar', authMiddleware, controller.entregarTicket.bind(controller));

export default router;
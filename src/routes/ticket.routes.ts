import { Router } from "express";
import { TicketsController } from "../controllers/tickets.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = TicketsController.getInstance();

// Todas las rutas usan authMiddleware para proteger los datos de la óptica
router.post('/', authMiddleware, controller.createTicket.bind(controller));
router.get('/', authMiddleware, controller.getTickets.bind(controller));
router.get('/:id', authMiddleware, controller.getTicketById.bind(controller));

router.put('/:id/status', authMiddleware, controller.updateStatus.bind(controller));
router.post('/:id/deliver', authMiddleware, controller.deliverTicket.bind(controller));

export default router;
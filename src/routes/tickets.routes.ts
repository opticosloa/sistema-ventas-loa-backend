import { Router } from "express";
import { TicketsController } from "../controllers/tickets.controller";

const router = Router();
const controller = TicketsController.getInstance();

// Rutas de Tickets
// Definidas según requerimientos:

router.post("/", controller.createTicket.bind(controller));
router.get("/", controller.getTickets.bind(controller));
router.put("/:id/status", controller.updateStatus.bind(controller));
router.post("/:id/deliver", controller.deliverTicket.bind(controller));

// Opcional: Ruta para obtener uno solo si se requiere en el futuro
// router.get("/:id", controller.getTicketById.bind(controller)); 

export default router;

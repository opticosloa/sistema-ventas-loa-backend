import { Router } from "express";
import { TicketsController } from "../controllers/tickets.controller";

const router = Router();
const controller = TicketsController.getInstance();

router.post("/", controller.createTicket.bind(controller));
router.get("/", controller.getTickets.bind(controller));
router.get("/:id", controller.getTicketById.bind(controller));
router.put("/:id/status", controller.updateStatus.bind(controller));
router.post("/:id/deliver", controller.deliverTicket.bind(controller));

export default router;
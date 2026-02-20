import { Router } from "express";
import { ClientsController } from "../controllers/clients.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = ClientsController.getInstance();

router.post("/", controller.createClient.bind(controller));
router.get('/', controller.getClients.bind(controller));
router.get('/by-id/:id', controller.getClientById.bind(controller));
router.get('/by-dni/:dni', controller.getClientByDNI.bind(controller));
router.put('/:id', controller.updateClient.bind(controller));
router.delete('/:id', controller.deleteClient.bind(controller));
router.get('/:id/account-status', controller.getAccountStatus.bind(controller));
router.post('/:id/balance-adjustment', authMiddleware, controller.adjustBalance.bind(controller));

export default router;

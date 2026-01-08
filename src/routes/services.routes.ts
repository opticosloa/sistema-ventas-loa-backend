import { Router } from "express";
import { ServicesController } from "../controllers/services.controller";

const router = Router();
const controller = ServicesController.getInstance();

router.post("/", controller.createService.bind(controller));
router.get('/', controller.getServices.bind(controller));
router.get('/:id', controller.getServiceById.bind(controller));
router.put('/:id', controller.updateService.bind(controller));
router.delete('/:id', controller.deleteService.bind(controller));

export default router;

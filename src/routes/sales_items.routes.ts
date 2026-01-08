import { Router } from "express";
import { SalesItemsController } from "../controllers/sales_items.controller";

const router = Router();
const controller = SalesItemsController.getInstance();

router.post("/", controller.createSalesItem.bind(controller));
router.get('/venta/:venta_id', controller.getSalesItemsBySaleId.bind(controller));
router.put('/:id', controller.updateSalesItem.bind(controller));
router.delete('/:id', controller.deleteSalesItem.bind(controller));

export default router;

import { Router } from "express";
import { ProductsController } from "../controllers/products.controller";

const router = Router();
const controller = ProductsController.getInstance();

router.get("/", controller.getProductos.bind(controller));
router.get("/all", controller.getAllProductos.bind(controller));
router.get('/list', controller.getProductList.bind(controller));
router.get('/:id', controller.getProductById.bind(controller));

router.post("/", controller.createProducto.bind(controller));

router.delete("/:id", controller.deleteProducto.bind(controller));

router.put("/:id", controller.updateProducto.bind(controller));

export default router;

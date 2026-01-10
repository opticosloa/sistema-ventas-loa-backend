import { Router } from "express";
import { ProductsController } from "../controllers/products.controller";

const router = Router();
const controller = ProductsController.getInstance();

router.get("/", controller.getProducts.bind(controller));
// router.get("/all", controller.getAllProductos.bind(controller)); // Deprecated or renamed
// router.get('/list', controller.getProductList.bind(controller)); // Deprecated or renamed
router.get('/:id', controller.getProductById.bind(controller));

router.post("/", controller.createProduct.bind(controller));

router.delete("/:id", controller.deleteProducto.bind(controller)); // Re-adding if needed later or comment out to fix lint

router.put("/:id", controller.updateProducto.bind(controller));

export default router;

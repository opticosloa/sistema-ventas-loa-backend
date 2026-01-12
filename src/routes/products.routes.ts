import { Router } from "express";
import { ProductsController } from "../controllers/products.controller";

const router = Router();
const controller = ProductsController.getInstance();

router.get("/", controller.getProducts.bind(controller));
router.post("/", controller.createProduct.bind(controller));
router.get('/search/:search', controller.productsSearch.bind(controller));
router.get('/type/:tipo', controller.getProductsByTipo.bind(controller));
router.get('/:id', controller.getProductById.bind(controller));
router.delete("/:id", controller.deleteProducto.bind(controller));
router.put("/:id", controller.updateProducto.bind(controller));

export default router;

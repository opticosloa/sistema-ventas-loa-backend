import { Router } from "express";
import { ProductsController } from "../controllers/products.controller";
import { authMiddleware } from "../middlewares";

const router = Router();
const controller = ProductsController.getInstance();

router.get("/", controller.getProducts.bind(controller));
router.post("/", authMiddleware, controller.createProduct.bind(controller));
router.get('/search/:search', controller.productsSearch.bind(controller));
router.get('/type/:tipo', controller.getProductsByTipo.bind(controller));
router.get('/:id', controller.getProductById.bind(controller));
router.delete("/:id", authMiddleware, controller.deleteProducto.bind(controller));
router.put("/:id", authMiddleware, controller.updateProducto.bind(controller));
router.post("/update-prices-by-brand", authMiddleware, controller.updatePricesByBrand.bind(controller));
router.post("/bulk-upsert", authMiddleware, controller.bulkUpsert.bind(controller));
// Nuevas rutas para Multi-Branch
router.post("/:id/stock-distribution", authMiddleware, controller.assignStockDistribution.bind(controller));
router.get("/:id/stock-details", authMiddleware, controller.getStockDistribution.bind(controller));

export default router;

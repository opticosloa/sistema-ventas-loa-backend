import { Router } from "express";
import { BrandController } from "../controllers/brand.controller";


const router = Router();
const controller = BrandController.getInstance();

router.get('/', controller.getBrands.bind(controller));
router.post('/', controller.createBrand.bind(controller));
router.get('/search', controller.searchBrands.bind(controller));
router.get('/:id', controller.getBrandById.bind(controller));
router.put('/:id', controller.updateBrand.bind(controller));
router.delete('/:id', controller.deleteBrand.bind(controller));

export default router;
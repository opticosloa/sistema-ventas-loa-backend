import { Router } from 'express';
import { StockPdfController } from '../controllers/stock.pdf.controller';

const router = Router();
const controller = StockPdfController.getInstance();

router.post('/labels', controller.generateLabels.bind(controller));

export default router;

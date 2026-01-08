import { Router } from 'express';
import { PrescriptionController } from '../controllers/prescription.controller';
import multer from 'multer';
import { authMiddleware } from '../middlewares';

const router = Router();
const controller = PrescriptionController.getInstance();

router.post('/upload', (req, res, next) => {
  // Middleware de Multer para manejar la subida
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos de imagen'));
      }
    },
  }).single('file');

  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next(); // Pasa al controller si no hay errores
  });
}, controller.uploadPrescription.bind(controller));

router.get('/', authMiddleware, controller.getPrescription.bind(controller));
router.post('/', authMiddleware, controller.createPrescription.bind(controller));
router.get('/client/:cliente_id', authMiddleware, controller.getPrescriptionsByClientId.bind(controller));
router.get('/client/dni/:dni', authMiddleware, controller.getPrescriptionsByClientDni.bind(controller));
router.get('/:id', authMiddleware, controller.getPrescriptionById.bind(controller));

// Product association routes
router.post('/:id/products', authMiddleware, controller.associateProduct.bind(controller));
router.get('/:id/products', authMiddleware, controller.getPrescriptionProducts.bind(controller));

export default router;
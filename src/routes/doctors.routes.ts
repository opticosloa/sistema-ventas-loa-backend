import { Router } from 'express';
import { DoctorController } from '../controllers/doctors.controller';

const router = Router();
const controller = DoctorController.getInstance();

router.post('/', controller.createDoctor.bind(controller));
router.get('/', controller.getDoctors.bind(controller));
router.get('/by-matricula/:matricula', controller.getDoctorByMatricula.bind(controller));
router.get('/:id', controller.getDoctorById.bind(controller));
router.put('/:id', controller.updateDoctor.bind(controller));
router.delete('/:id', controller.deactivateDoctor.bind(controller));

export default router;

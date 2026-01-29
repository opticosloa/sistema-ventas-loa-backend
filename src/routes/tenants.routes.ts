import { Router } from 'express';
import { TenantsController } from '../controllers/tenants.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { isSuperAdmin } from '../middlewares/isSuperAdmin';

const router = Router();
const controller = TenantsController.getInstance();

router.use(authMiddleware);
router.use(isSuperAdmin);

router.post('/', controller.createTenant.bind(controller));
router.get('/', controller.getTenants.bind(controller));
router.post('/user-branch', controller.changeUserBranch.bind(controller));
router.get('/:id', controller.getTenantById.bind(controller));
router.put('/:id', controller.updateTenant.bind(controller));
router.delete('/:id', controller.deleteTenant.bind(controller));
router.get('/search/:nombre', controller.searchTenantByName.bind(controller));

export default router;

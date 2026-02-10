import { Router } from 'express';
import { TenantsController } from '../controllers/tenants.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { isAdmin, isSuperAdmin } from '../middlewares';

const router = Router();
const controller = TenantsController.getInstance();

// 1. Middleware base para todos (deben estar logueados)
router.use(authMiddleware);

// 2. Rutas Públicas para usuarios logueados (Cualquier rol)
router.get('/', controller.getTenants.bind(controller));
router.get('/:id', controller.getTenantById.bind(controller));
router.get('/search/:nombre', controller.searchTenantByName.bind(controller));

// 3. Rutas Restringidas (Solo SuperAdmin)
router.post('/', isSuperAdmin, controller.createTenant.bind(controller));
router.put('/:id', isSuperAdmin, controller.updateTenant.bind(controller));
router.delete('/:id', isSuperAdmin, controller.deleteTenant.bind(controller));
router.post('/user-branch', isAdmin, controller.changeUserBranch.bind(controller));

export default router;
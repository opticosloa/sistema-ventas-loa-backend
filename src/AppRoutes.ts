import { Router } from 'express';

import productsRoutes from './routes/products.routes';
import prescriptionRoutes from './routes/prescription.routes';
import ticketRoutes from './routes/ticket.routes';
import brandRoutes from './routes/brand.routes';
import salesRoutes from './routes/sales.routes';
import clientsRoutes from './routes/clients.routes';
import servicesRoutes from './routes/services.routes';
import alertsRoutes from './routes/alerts.routes';
import doctorsRoutes from './routes/doctors.routes';
import usersRoutes from './routes/users.routes';
import tenantsRoutes from './routes/tenants.routes';
import paymentsRoutes from './routes/payments.routes';




export class AppRoutes {
    static get routes(): Router {
        const router = Router();

        router.use('/api/products', productsRoutes);
        router.use('/api/prescriptions', prescriptionRoutes);
        router.use('/api/tickets', ticketRoutes);
        router.use('/api/brands', brandRoutes);
        router.use('/api/sales', salesRoutes);
        router.use('/api/sales-items', salesRoutes);
        router.use('/api/clients', clientsRoutes);
        router.use('/api/services', servicesRoutes);
        router.use('/api/users', usersRoutes);
        router.use('/api/doctors', doctorsRoutes);
        router.use('/api/tenants', tenantsRoutes);
        router.use('/api/alerts', alertsRoutes);
        router.use('/api/payments', paymentsRoutes);

        return router;
    }
}
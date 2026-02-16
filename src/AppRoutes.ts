import { Router } from 'express';
import stockRoutes from './routes/stock.routes';
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
import salesItemsRoutes from './routes/sales_items.routes';
import crystalsRoutes from './routes/crystals.routes';
import cashierRoutes from './routes/cashier.routes';
import currencyRoutes from './routes/currency.routes';
import obrasSocialesRoutes from './routes/obras_sociales.routes';
import liquidacionesRoutes from './routes/liquidaciones.routes';
import providersRoutes from './routes/providers.routes';
import cashRoutes from './routes/cash.routes';
import multifocalesRoutes from './routes/multifocales.routes';
import workshopsRoutes from './routes/workshops.routes';

export class AppRoutes {
    static get routes(): Router {
        const router = Router();

        router.use('/api/products', productsRoutes);
        router.use('/api/prescriptions', prescriptionRoutes);
        router.use('/api/tickets', ticketRoutes);
        router.use('/api/brands', brandRoutes);
        router.use('/api/sales', salesRoutes);
        router.use('/api/sales-items', salesItemsRoutes);
        router.use('/api/clients', clientsRoutes);
        router.use('/api/services', servicesRoutes);
        router.use('/api/users', usersRoutes);
        router.use('/api/doctors', doctorsRoutes);
        router.use('/api/tenants', tenantsRoutes);
        router.use('/api/alerts', alertsRoutes);
        router.use('/api/payments', paymentsRoutes);
        router.use('/api/crystals', crystalsRoutes);
        router.use('/api/cashier', cashierRoutes);
        router.use('/api/cash', cashRoutes);
        router.use('/api/currency', currencyRoutes);
        router.use('/api/obras-sociales', obrasSocialesRoutes);
        router.use('/api/liquidaciones', liquidacionesRoutes);
        router.use('/api/providers', providersRoutes);
        router.use('/api/stock', stockRoutes);
        router.use('/api/multifocales', multifocalesRoutes);
        router.use('/api/workshops', workshopsRoutes);

        return router;
    }
}
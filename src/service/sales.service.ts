import { PostgresDB } from '../database/postgres';

export class SalesService {
    private static instance: SalesService;

    private constructor() { }

    public static getInstance(): SalesService {
        if (!SalesService.instance) {
            SalesService.instance = new SalesService();
        }
        return SalesService.instance;
    }

    public async getEstadoPago(ventaId: string) {
        const result: any = await PostgresDB
            .getInstance()
            .callStoredProcedure('sp_venta_estado_pago_get', [ventaId]);

        if (!result || result.length === 0) {
            return null;
        }

        // El SP devuelve un array de filas, tomamos la primera
        const rows = result.rows || result;
        if (rows.length === 0) return null;

        const { estado_venta, estado_pago } = rows[0];

        return {
            estado_venta,
            estado_pago
        };
    }
}

import { PostgresDB } from "../database/postgres";
import { ObraSocial } from "../types/obrasSociales";


export class ObrasSocialesService {
    private static instance: ObrasSocialesService;

    private constructor() { }

    public static getInstance(): ObrasSocialesService {
        if (!ObrasSocialesService.instance) {
            ObrasSocialesService.instance = new ObrasSocialesService();
        }
        return ObrasSocialesService.instance;
    }

    public async getAll(activo?: boolean) {
        // If activo is undefined, list all. If true/false, filter by it.
        // Assuming SP handles logic or we filter here if SP returns all.
        // Let's assume sp_obra_social_listar returns everything and we can filter if needed, 
        // or the SP accepts a filter. For now, simple list.
        const result = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_listar');
        return result.rows;
    }

    public async upsert(data: ObraSocial) {
        // sp_obra_social_upsert(id, nombre, sitio, instrucciones, activo)
        const result = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_upsert', [
            data.obra_social_id || null, // 1. p_id
            data.nombre,                 // 2. p_nombre
            data.plan || null,           // 3. p_plan
            data.sitio_web || null,      // 4. p_sitio_web
            data.instrucciones || null,  // 5. p_instrucciones
            data.activo,                 // 6. p_activo
            JSON.stringify(data.cobertura || {}), // 7. p_cobertura
            data.cobertura_armazon_max || 0, // 8. p_cobertura_armazon_max
            data.cobertura_cristal_max || 0, // 9. p_cobertura_cristal_max
            data.monto_cobertura_total || 0  // 10. p_monto_cobertura_total
        ]);
        return result.rows[0];
    }
}

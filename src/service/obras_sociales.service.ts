import { PostgresDB } from "../database/postgres";

export interface ObraSocial {
    obra_social_id?: number;
    nombre: string;
    sitio_web?: string;
    instrucciones?: string;
    activo: boolean;
}

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
            data.obra_social_id || null, // null for create
            data.nombre,
            data.sitio_web || null,
            data.instrucciones || null,
            data.activo
        ]);
        return result.rows[0];
    }
}

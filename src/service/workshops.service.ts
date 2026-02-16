import { PostgresDB } from "../database/postgres";

export interface Workshop {
    taller_id?: string;
    nombre: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    cuit?: string;
    tiempo_demora?: string;
    empleados?: any[]; // JSON array of employees
    is_active?: boolean;
}

export class WorkshopsService {
    private static instance: WorkshopsService;

    private constructor() { }

    public static getInstance(): WorkshopsService {
        if (!WorkshopsService.instance) {
            WorkshopsService.instance = new WorkshopsService();
        }
        return WorkshopsService.instance;
    }

    public async upsert(data: Workshop): Promise<string> {
        const { taller_id, nombre, direccion, telefono, email, cuit, tiempo_demora, empleados, is_active } = data;

        const result = await PostgresDB.getInstance().callStoredProcedure('sp_taller_upsert', [
            taller_id || null,
            nombre,
            direccion || null,
            telefono || null,
            email || null,
            cuit || null,
            tiempo_demora || null,
            JSON.stringify(empleados || []),
            is_active !== undefined ? is_active : true
        ]);

        // Access the result using the function name as the key
        const newId = result.rows[0]?.sp_taller_upsert || result.rows[0]?.taller_id;

        if (!newId) {
            throw new Error("Failed to upsert workshop");
        }

        return newId;
    }

    public async getAll(onlyActive: boolean = true): Promise<Workshop[]> {
        const result = await PostgresDB.getInstance().callStoredProcedure('sp_taller_listar', [onlyActive]);
        return result.rows as Workshop[];
    }
}

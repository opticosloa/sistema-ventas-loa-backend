import { PostgresDB } from "../database/postgres";

export class MultifocalesService {
    private static instance: MultifocalesService;

    private constructor() { }

    public static getInstance(): MultifocalesService {
        if (!MultifocalesService.instance) {
            MultifocalesService.instance = new MultifocalesService();
        }
        return MultifocalesService.instance;
    }

    public async search(query: string = '') {
        const result = await PostgresDB.getInstance().callStoredProcedure('sp_multifocal_buscar', [
            query || null
        ]);
        return result.rows;
    }

    public async upsert(data: {
        id?: string;
        marca: string;
        modelo: string;
        material: string;
        tratamiento: string;
        esfera_desde: number;
        esfera_hasta: number;
        cilindro_desde: number;
        cilindro_hasta: number;
        precio: number;
        costo: number;
    }) {
        const {
            id, marca, modelo, material, tratamiento,
            esfera_desde, esfera_hasta, cilindro_desde, cilindro_hasta,
            precio, costo
        } = data;

        const result = await PostgresDB.getInstance().callStoredProcedure('sp_multifocal_upsert', [
            id || null,
            marca,
            modelo,
            material,
            tratamiento || null,
            Number(esfera_desde),
            Number(esfera_hasta),
            Number(cilindro_desde),
            Number(cilindro_hasta),
            Number(precio),
            Number(costo || 0)
        ]);

        return result.rows[0];
    }
    // --- MARCAS ---
    public async getBrands() {
        const result = await PostgresDB.getInstance().executeQuery(
            "SELECT * FROM multifocal_marcas WHERE activo = true ORDER BY nombre"
        );
        return result.rows;
    }

    public async createBrand(nombre: string) {
        const result = await PostgresDB.getInstance().executeQuery(
            "INSERT INTO multifocal_marcas (nombre) VALUES ($1) RETURNING *",
            [nombre]
        );
        return result.rows[0];
    }

    public async updateBrand(id: string, nombre: string, activo: boolean = true) {
        const result = await PostgresDB.getInstance().executeQuery(
            "UPDATE multifocal_marcas SET nombre = $2, activo = $3 WHERE marca_id = $1 RETURNING *",
            [id, nombre, activo]
        );
        return result.rows[0];
    }

    // --- MODELOS ---
    public async getModels(marcaId?: string) {
        let query = "SELECT * FROM multifocal_modelos WHERE activo = true";
        const params: any[] = [];

        if (marcaId) {
            query += " AND marca_id = $1";
            params.push(marcaId);
        }

        query += " ORDER BY nombre";

        const result = await PostgresDB.getInstance().executeQuery(query, params);
        return result.rows;
    }

    public async createModel(marcaId: string, nombre: string) {
        const result = await PostgresDB.getInstance().executeQuery(
            "INSERT INTO multifocal_modelos (marca_id, nombre) VALUES ($1, $2) RETURNING *",
            [marcaId, nombre]
        );
        return result.rows[0];
    }

    public async updateModel(id: string, nombre: string, activo: boolean = true) {
        const result = await PostgresDB.getInstance().executeQuery(
            "UPDATE multifocal_modelos SET nombre = $2, activo = $3 WHERE modelo_id = $1 RETURNING *",
            [id, nombre, activo]
        );
        return result.rows[0];
    }
}

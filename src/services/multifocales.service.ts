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
}

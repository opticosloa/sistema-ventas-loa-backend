export interface ObraSocial {
    obra_social_id?: string; // UUID
    nombre: string;
    plan?: string;
    sitio_web?: string;
    instrucciones?: string;
    activo?: boolean;
    monto_cobertura_total?: number;
    cobertura_armazon_max?: number;
    cobertura_cristal_max?: number;
    cobertura?: {
        porcentaje_cristales: number;
        porcentaje_armazones: number;
    };
}

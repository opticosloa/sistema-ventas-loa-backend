export interface ObraSocial {
    obra_social_id?: string; // UUID
    nombre: string;
    plan?: string; // Optional or required? User example shows it. Let's make it optional string for now or check usage. User says "nombre: string, plan: string".
    sitio_web?: string; // Optional
    instrucciones?: string; // Optional
    activo?: boolean;
    cobertura?: {
        porcentaje_cristales: number;
        porcentaje_armazones: number;
    };
}

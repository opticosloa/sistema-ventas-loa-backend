
export interface Sales {
    venta_id: string;
    vendedor_id: string;
    despachante_id?: string;
    cliente_id: string;
    fecha_entrada: string;
    fecha_salida?: string;
    urgente: boolean;
    estado: string;
    medio_pago?: string;
    pagado: boolean;
    total: number;
    created_at: string;
    updated_at: string;
}
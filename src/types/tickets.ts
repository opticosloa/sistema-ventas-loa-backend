export interface Ticket {
    ticket_id?: string;
    venta_id: string;
    cliente_id: string;
    usuario_id: string;
    fecha_entrega_estimada: string;
    fecha_entrega_real?: string;
    estado: string;
    notas?: string;
    created_at?: string;
    updated_at?: string;
}

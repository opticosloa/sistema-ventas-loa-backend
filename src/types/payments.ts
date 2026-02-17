export enum PaymentMethod {
    MP = 'MP',
    EFECTIVO = 'EFECTIVO',
    DEBITO = 'DEBITO',
    CREDITO = 'CREDITO',
    TRANSFERENCIA = 'TRANSFERENCIA',
    POSNET_BANCARIO = 'POSNET_BANCARIO'
}

export enum PaymentStatus {
    PENDIENTE = 'PENDIENTE',
    APROBADO = 'APROBADO',
    RECHAZADO = 'RECHAZADO'
}

export interface Payment {
    pago_id?: string;
    venta_id: string;
    metodo: PaymentMethod | string;
    monto: number;
    estado?: PaymentStatus | string;
    mp_preference_id?: string;
    mp_payment_id?: string;
    mp_status?: string;
    created_at?: string;
    updated_at?: string;
}

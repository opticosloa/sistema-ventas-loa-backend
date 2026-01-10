export interface User {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    password_hash: string;
    rol: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    sucursal_id: string;
    security_pin?: string;
    cuit?: number;
    telefono?: string;
    direccion?: string;
    fecha_nacimiento?: string;
    cuenta_corriente?: number;
}

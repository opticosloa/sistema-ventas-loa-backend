export interface Doctor {
    doctor_id: string;
    nombre: string;
    matricula?: string;
    especialidad?: string;
    telefono?: string;
    email?: string;
    is_active?: boolean;
    created_at?: Date;
    updated_at?: Date;
}

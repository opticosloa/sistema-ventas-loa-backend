export interface Sucursal {
    sucursal_id?: string;
    nombre: string;
    encargado: string;
    direccion: string;
    telefono: string;
    email: string;
    is_active?: boolean;
    created_at?: string;
    mp_public_key?: string;
    mp_access_token?: string;
    mp_user_id?: string;
    color_identificativo?: string;
}

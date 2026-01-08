
export interface SalesItem {
    venta_item_id: string;
    venta_id: string;
    producto_id?: string;
    servicio_id?: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    created_at: string;
}
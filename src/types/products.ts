
// // DROP TYPE IF EXISTS "public"."producto_tipos";
// CREATE TYPE "public"."producto_tipos" AS ENUM ('ARMAZON', 'CRISTAL', 'ACCESORIO');

// -- Table Definition
// CREATE TABLE "public"."productos" (
//     "producto_id" uuid NOT NULL DEFAULT gen_random_uuid(),
//     "nombre" varchar(100) NOT NULL,
//     "descripcion" text,
//     "tipo" "public"."producto_tipos" NOT NULL,
//     "marca_id" uuid,
//     "precio_costo" numeric(12,2) NOT NULL,
//     "precio_venta" numeric(12,2) NOT NULL,
//     "iva" int4 DEFAULT 21,
//     "stock" int4 NOT NULL DEFAULT 0,
//     "stock_minimo" int4 DEFAULT 0,
//     "ubicacion" varchar(50),
//     "qr_code" text,
//     "ultima_venta" timestamptz,
//     "created_at" timestamptz DEFAULT now(),
//     "updated_at" timestamptz DEFAULT now(),
//     "is_active" bool NOT NULL DEFAULT true,
//     CONSTRAINT "fk_productos_marca" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("marca_id") ON DELETE SET NULL,
//     PRIMARY KEY ("producto_id")
// );


// -- Indices
// CREATE INDEX idx_productos_stock ON public.productos USING btree (stock);
// CREATE INDEX idx_productos_tipo ON public.productos USING btree (tipo);
// CREATE UNIQUE INDEX uq_productos_codigo ON public.productos USING btree (nombre, marca_id);
// CREATE UNIQUE INDEX productos_nombre_marca_unique ON public.productos USING btree (nombre, marca_id);
// CREATE INDEX idx_productos_busqueda ON public.productos USING btree (nombre);
// CREATE INDEX idx_productos_is_active ON public.productos USING btree (is_active);

export interface Product {
    producto_id: string;
    nombre: string;
    descripcion: string;
    tipo: string;
    marca_id: string;
    precio_costo: number;
    precio_venta: number;
    iva: number;
    stock: number;
    stock_minimo: number;
    ubicacion: string;
    qr_code: string;
    ultima_venta: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    codigo_qr?: string;
}
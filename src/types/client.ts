
// -- Table Definition
// CREATE TABLE "public"."clientes" (
//     "cliente_id" uuid NOT NULL DEFAULT gen_random_uuid(),
//     "nombre" varchar(60) NOT NULL,
//     "apellido" varchar(60) NOT NULL,
//     "telefono" varchar(30),
//     "email" varchar(100),
//     "dni" varchar(20),
//     "direccion" varchar(200),
//     "fecha_nacimiento" date,
//     "cuenta_corriente" numeric(12,2) DEFAULT 0,
//     "created_at" timestamptz DEFAULT now(),
//     "updated_at" timestamptz DEFAULT now(),
//     PRIMARY KEY ("cliente_id")
// );


// -- Indices
// CREATE INDEX idx_clientes_dni ON public.clientes USING btree (dni);
// CREATE INDEX idx_clientes_telefono ON public.clientes USING btree (telefono);
// CREATE UNIQUE INDEX unique_cliente_dni ON public.clientes USING btree (dni);
// CREATE UNIQUE INDEX uq_clientes_dni ON public.clientes USING btree (dni);

export interface Client {
    cliente_id: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    email?: string;
    dni?: string;
    direccion?: string;
    fecha_nacimiento?: string;
    cuenta_corriente?: number;
    created_at?: string;
    updated_at?: string;
}
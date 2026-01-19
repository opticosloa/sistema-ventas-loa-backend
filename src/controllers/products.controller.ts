import type { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import * as QRCode from 'qrcode';
import { Product } from "../types/products";

export class ProductsController {
    private static instance: ProductsController;

    private constructor() { }

    public static getInstance(): ProductsController {
        if (!ProductsController.instance) {
            ProductsController.instance = new ProductsController();
        }
        return ProductsController.instance;
    }

    public async getProducts(req: Request, res: Response) {
        const { tipo } = req.query;

        try {
            let query = 'SELECT * FROM productos WHERE is_active = true';
            const params: any[] = [];

            if (tipo) {
                query += ' AND tipo = $1';
                params.push((tipo as string).toUpperCase());
            }

            query += ' ORDER BY nombre ASC';

            const result = await PostgresDB.getInstance().executeQuery(query, params);
            res.json({ success: true, result: result.rows || result }); // Adjust based on DB wrapper return
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Error obteniendo productos' });
        }
    }

    public async createProduct(req: Request, res: Response) {
        const {
            nombre,
            descripcion,
            tipo,
            marca_id,
            precio_costo,
            precio_usd,
            iva,
            stock,
            stock_minimo,
            ubicacion,
            codigo_qr,
            is_active
        } = req.body;

        try {
            const db = PostgresDB.getInstance();
            const nombreUpper = nombre.trim().toUpperCase();

            // 1. Verificación de duplicados (Asegúrate de que este SP también tenga 3 params)
            const existing = await db.callStoredProcedure('sp_producto_get_by_nombre', [
                nombreUpper, tipo, marca_id || null
            ]);

            if (existing.rows.length > 0) {
                return res.json({ success: true, conflict: true, existingProduct: existing.rows[0] });
            }

            // 2. Llamada al SP con el orden EXACTO de 12 parámetros
            const result = await db.callStoredProcedure('sp_producto_crear', [
                nombreUpper,
                descripcion || null,
                tipo,
                marca_id || null,
                precio_costo || 0,
                precio_usd || 0,
                iva || 21,
                stock || 0,
                stock_minimo || 0,
                ubicacion || null,
                codigo_qr && codigo_qr.trim() !== "" ? codigo_qr : null,
                is_active ?? true
            ]);

            const producto_id = result.rows[0].sp_producto_crear;

            // 3. Lógica de QR (si es necesario)
            if (!codigo_qr && producto_id) {
                const qrDataURL = await QRCode.toDataURL(producto_id.toString());
                await db.executeQuery(
                    'UPDATE productos SET codigo_qr = $1 WHERE producto_id = $2',
                    [qrDataURL, producto_id]
                );
            }

            res.status(201).json({ success: true, result: { producto_id, message: 'Producto creado' } });

        } catch (error: any) {
            console.error('❌ Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async updateProducto(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, descripcion, tipo, marca_id, precio_costo, precio_venta, iva, stock, stock_minimo, ubicacion, is_active
        }: Product = req.body;

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_editar', [
                id,
                nombre,
                descripcion,
                tipo,
                marca_id,
                precio_costo,
                precio_venta,
                iva,
                stock,
                stock_minimo,
                ubicacion,
                is_active
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteProducto(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_desactivar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    // Mantener métodos antiguos por compatibilidad si es necesario, o refactorizar rutas.
    // ... (Otros métodos omitidos por brevedad si no son requeridos explícitamente en este paso, pero es mejor dejarlos si el router los usa)

    public async getProductById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_producto_get_by_id', [id]);
            if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, error });
        }
    }

    public async productsSearch(req: Request, res: Response) {
        const { search } = req.params;
        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_producto_buscar', [search]);
            res.json({ success: true, result: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, error });
        }
    }

    public async getProductsByTipo(req: Request, res: Response) {
        const { tipo } = req.params;

        try {
            // Support for multiple types separated by comma (e.g. "ARMAZON,ANTEOJO_SOL")
            if (!tipo) {
                return res.status(400).json({ success: false, error: 'Tipo de producto no proporcionado' });
            }
            const typesArray = tipo.split(',').map(t => t.trim().toUpperCase());

            const query = `
                SELECT p.*, m.nombre as marca
                FROM productos p
                LEFT JOIN marcas m ON p.marca_id = m.marca_id
                WHERE p.tipo = ANY($1) 
                AND p.is_active = true 
                ORDER BY p.nombre ASC
            `;

            const result = await PostgresDB.getInstance().executeQuery(query, [typesArray]);

            res.json({
                success: true,
                result: result.rows
            });
        } catch (error) {
            console.error("Error en getProductsByTipo:", error);
            res.status(500).json({ success: false, error: 'Error al filtrar productos por tipo' });
        }
    }
}
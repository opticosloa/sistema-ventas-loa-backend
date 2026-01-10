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
                params.push(tipo);
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
            nombre, descripcion, tipo, precio_costo, precio_venta, stock, stock_minimo, ubicacion, codigo_qr
        }: Product = req.body;

        if (!nombre || !tipo || !precio_venta) {
            return res.status(400).json({ success: false, error: 'Campos obligatorios faltantes' });
        }

        try {
            // Generar QR si no viene
            let finalQr = codigo_qr;

            // 1. Insertar
            // Nota: Asumimos que la tabla tiene las columnas correspondientes. Ajustar si faltan.
            const query = `
                INSERT INTO productos (
                    nombre, descripcion, tipo, precio_costo, precio_venta, stock, stock_minimo, ubicacion, codigo_qr, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                RETURNING *
            `;

            const values = [
                nombre.toUpperCase(),
                descripcion || null,
                tipo,
                precio_costo || 0,
                precio_venta,
                stock || 0,
                stock_minimo || 0,
                ubicacion || null,
                'PENDING_QR' // Placeholder
            ];

            const result: any = await PostgresDB.getInstance().executeQuery(query, values);
            const newProduct = result.rows[0];

            // 2. Generar QR Real con ID si no vino uno
            if (!finalQr && newProduct.producto_id) {
                finalQr = await QRCode.toDataURL(newProduct.producto_id.toString());
                await PostgresDB.getInstance().executeQuery(
                    'UPDATE productos SET codigo_qr = $1 WHERE producto_id = $2',
                    [finalQr, newProduct.producto_id]
                );
                newProduct.codigo_qr = finalQr;
            }

            res.status(201).json({ success: true, result: newProduct });

        } catch (error: any) {
            console.error('Error creando producto:', error);
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
            const result: any = await PostgresDB.getInstance().executeQuery('SELECT * FROM productos WHERE producto_id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, error });
        }
    }
}
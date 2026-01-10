import type { Request, Response, NextFunction } from 'express';
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

    public async createProducto(req: Request, res: Response) {
        const {
            nombre, descripcion, tipo, marca_id, precio_costo, precio_venta, iva, stock, stock_minimo, ubicacion
        }: Product = req.body;

        let nombreUpper = nombre.toUpperCase();
        try {
            // 1. Llamada al SP para crear el producto
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_producto_crear', [
                nombreUpper, descripcion, tipo, marca_id, precio_costo, precio_venta, iva, stock, stock_minimo, ubicacion
            ]);

            // 2. Extraer el ID de forma robusta
            // Los SP en PostgreSQL suelen devolver el ID en la primera fila, primera columna
            const rows = result.rows || result;
            if (!rows || rows.length === 0) {
                throw new Error('No se recibió respuesta al crear el producto');
            }

            const productId = rows[0].producto_id || Object.values(rows[0])[0];

            // 3. Lógica de QR 
            try {
                // Generamos el QR con el ID (puedes añadir una URL si prefieres)
                const qrCodeImage = await QRCode.toDataURL(productId.toString());
                // Actualizamos el registro con el QR generado
                await PostgresDB.getInstance().executeQuery(
                    'UPDATE productos SET qr_code = $1 WHERE producto_id = $2',
                    [qrCodeImage, productId]
                );
                // Actualizamos el objeto en memoria para la respuesta
                rows[0].qr_code = qrCodeImage;
            } catch (qrError) {
                console.error('Error generando QR:', qrError);
                // No bloqueamos la respuesta principal si falla el QR
            }

            res.status(201).json({
                success: true,
                message: 'Producto creado correctamente',
                result: rows[0]
            });

        } catch (error: any) {
            console.error('Error en createProducto:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error interno del servidor'
            });
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

    public async getProductos(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_get_available');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.json({ success: false, error });
        }
    }

    public async getAllProductos(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_get_all');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.json({ success: false, error });
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

    public async getProductById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result: any = await PostgresDB.getInstance().callStoredProcedure('sp_producto_get_by_id', [id]);
            const rows = result.rows || result;
            const product = rows[0] || null;

            if (!product) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            res.json({ success: true, result: product });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getProductList(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_listar');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }
}
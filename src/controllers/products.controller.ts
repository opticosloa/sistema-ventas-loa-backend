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
        const { tipo, sucursal_id } = req.query;

        try {
            let result;

            if (sucursal_id) {
                // SP: p_sucursal_id, p_solo_activos
                // Returns: producto_id, nombre, codigo_qr, precio_venta, stock_sucursal, stock_total, ubicacion_local
                result = await PostgresDB.getInstance().callStoredProcedure('sp_productos_listar_por_sucursal', [
                    sucursal_id,
                    true // p_solo_activos default true
                ]);

                // Map result to match expected frontend interface (Produto.stock)
                // If the SP returns stock_sucursal, we map it to 'stock' property for compatibility
                const rows = (result.rows || result).map((p: any) => ({
                    ...p,
                    stock: p.stock_sucursal // Override logic stock with branch stock
                }));

                res.json({ success: true, result: rows });
            } else {
                // Fallback / legacy logic
                let query = `
                    SELECT p.*, m.nombre as marca 
                    FROM productos p
                    LEFT JOIN marcas m ON p.marca_id = m.marca_id
                    WHERE p.is_active = true
                `;
                const params: any[] = [];

                if (tipo) {
                    query += ' AND tipo = $1';
                    params.push((tipo as string).toUpperCase());
                }

                query += ' ORDER BY nombre ASC';

                result = await PostgresDB.getInstance().executeQuery(query, params);
                res.json({ success: true, result: result.rows || result });
            }
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
        const {
            nombre, descripcion, tipo, marca_id, precio_costo, precio_venta,
            iva, stock, stock_minimo, ubicacion, is_active,
            stock_por_sucursal // New param: Array of { sucursal_id, cantidad }
        }: any = req.body;

        try {
            // 1. Update Product Details
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_editar', [
                id,
                nombre,
                descripcion,
                tipo,
                marca_id,
                precio_costo,
                precio_venta,
                iva,
                stock, // This might be total legacy stock, or ignored by SP depending on implementation
                stock_minimo,
                ubicacion,
                is_active
            ]);

            // 2. Update Stock Distribution (Direct Update/Override)
            if (stock_por_sucursal && Array.isArray(stock_por_sucursal) && stock_por_sucursal.length > 0) {
                await PostgresDB.getInstance().callStoredProcedure('sp_producto_asignar_stock_masivo', [
                    id,
                    JSON.stringify(stock_por_sucursal),
                    false // es_cristal default false for standard products
                ]);
            }

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

    public async updatePricesByBrand(req: Request, res: Response) {
        const { marca_id, porcentaje } = req.body;

        if (!marca_id || porcentaje === undefined) {
            return res.status(400).json({ success: false, error: 'Marca ID and Porcentaje are required' });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_actualizar_precios_marca', [marca_id, porcentaje]);
            res.json({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async assignStockDistribution(req: Request, res: Response) {
        const { id } = req.params;
        const { stock_data, es_cristal } = req.body; // Expects array of { sucursal_id, cantidad }

        try {
            // sp_producto_asignar_stock_masivo(p_producto_id, p_json_data, p_es_cristal)
            // p_json_data expected as JSON/JSONB
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_producto_asignar_stock_masivo', [
                id,
                JSON.stringify(stock_data), // Pass as string? Or object depending on DB wrapper. Usually string for JSON param.
                es_cristal || false
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.error('Error in assignStockDistribution:', error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getStockDistribution(req: Request, res: Response) {
        const { id } = req.params;

        try {
            // sp_stock_consultar_distribucion(p_producto_id)
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_stock_consultar_distribucion', [id]);
            res.json({ success: true, result: result.rows || result });
        } catch (error) {
            console.error('Error in getStockDistribution:', error);
            res.status(500).json({ success: false, error });
        }
    }

    public async decreaseStock(req: Request, res: Response) {
        const { id } = req.params; // Product ID
        const { sucursal_id, cantidad, es_cristal } = req.body;

        if (!sucursal_id || !cantidad) {
            return res.status(400).json({ success: false, error: 'Sucursal ID and Cantidad are required' });
        }

        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_stock_descontar_venta', [
                sucursal_id,
                id,
                cantidad,
                es_cristal || false
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.error('Error in decreaseStock:', error);
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

    public async bulkUpsert(req: Request, res: Response) {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'No items provided for bulk upsert' });
        }

        const db = PostgresDB.getInstance();

        try {
            // 1. Obtener cotización del dólar actual
            // We can use the helper or a direct query if we have a client. 
            // Since we want to use the generic callStoredProcedure from DB wrapper if possible, or executeQuery.
            // Let's use executeQuery for the config to be safe/consistent with existing code pattern, 
            // but simplified since we don't need a manual transaction transaction for the SP call (the SP is atomic enough or we wrap it).
            // Actually, for a single SP call, we don't strictly need a transaction block in Node unless we do multiple things.
            // The SP 'sp_productos_importar_excel_master' does multiple inserts/updates. 
            // It's better to get the rate first.

            const configResult = await db.callStoredProcedure(`sp_config_global_get`, ['cotizacion_dolar']);
            const dolarRate = Number(configResult.rows[0]?.valor || 0);

            if (!dolarRate || dolarRate <= 0) {
                return res.status(400).json({ success: false, error: 'Cotización del dólar no configurada o inválida (0).' });
            }

            // 2. Call the Master SP
            // sp_productos_importar_excel_master(p_items jsonb, p_dolar_rate numeric)
            const result = await db.callStoredProcedure('sp_productos_importar_excel_master', [
                JSON.stringify(items),
                dolarRate
            ]);

            // Result should be the json returned by the SP
            const response = result.rows[0].sp_productos_importar_excel_master;

            res.json(response);

        } catch (error: any) {
            console.error('Bulk Upsert Error:', error);
            res.status(500).json({ success: false, error: 'Import failed: ' + error.message });
        }
    }
}
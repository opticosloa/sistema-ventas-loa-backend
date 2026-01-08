import { ProductsController } from '../../controllers/products.controller';
import { PostgresDB } from '../../database/postgres';
import { Request, Response } from 'express';
import * as QRCode from 'qrcode';

// Mock PostgresDB
jest.mock('../../database/postgres', () => {
    return {
        PostgresDB: {
            getInstance: jest.fn().mockReturnValue({
                callStoredProcedure: jest.fn(),
                executeQuery: jest.fn(),
            }),
        },
    };
});

// Mock QRCode
jest.mock('qrcode', () => ({
    toDataURL: jest.fn(),
}));

describe('ProductsController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        req = {};
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = {
            json: jsonMock,
            status: statusMock,
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should create a product', async () => {
        req.body = {
            nombre: 'Prod 1', descripcion: 'Desc', tipo: 'LENS', marca_id: 1,
            precio_costo: 10, precio_venta: 20, iva: 21, stock: 100, stock_minimo: 5, ubicacion: 'A1'
        };
        const mockResult = { rows: [{ producto_id: 1 }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().createProducto(req as Request, res as Response, next);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_crear', [
            'Prod 1', 'Desc', 'LENS', 1, 10, 20, 21, 100, 5, 'A1'
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should create a product and generate QR for ARMAZON', async () => {
        req.body = {
            nombre: 'Frame 1', descripcion: 'Desc', tipo: 'ARMAZON', marca_id: 1,
            precio_costo: 50, precio_venta: 100, iva: 21, stock: 10, stock_minimo: 2, ubicacion: 'B1'
        };
        const mockResult = { rows: [{ sp_producto_crear: 123 }] }; // Assuming the SP returns the ID
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);
        (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,...');

        await ProductsController.getInstance().createProducto(req as Request, res as Response, next);

        expect(QRCode.toDataURL).toHaveBeenCalled();
        expect(PostgresDB.getInstance().executeQuery).toHaveBeenCalledWith(
            'UPDATE productos SET qr_code = $1 WHERE producto_id = $2',
            ['data:image/png;base64,...', 123]
        );
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should update a product', async () => {
        req.params = { id: '1' };
        req.body = { nombre: 'Prod Updated', is_active: true };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().updateProducto(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_editar', [
            '1', 'Prod Updated', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get available products', async () => {
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().getProductos(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_get_available');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get all products', async () => {
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().getAllProductos(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_get');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should delete (deactivate) a product', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().deleteProducto(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_desactivar', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get product by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().getProductosById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should list products', async () => {
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ProductsController.getInstance().getProductList(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_producto_listar');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });
});

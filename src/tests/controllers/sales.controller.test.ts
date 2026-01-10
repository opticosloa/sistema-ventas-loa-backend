import { SalesController } from '../../controllers/sales.controller';
import { PostgresDB } from '../../database/postgres';
import { Request, Response } from 'express';

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

describe('SalesController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        req = {
            body: {},
            user: { id: 1, sucursal_id: 2 } as any // Mock user content
        };
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = {
            json: jsonMock,
            status: statusMock,
        };
        jest.clearAllMocks();
    });

    it('should create a sale', async () => {
        req.body = { cliente_id: 10, urgente: true };
        const mockResult = [{ sp_venta_crear: 50 }];
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesController.getInstance().createSale(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_crear', [
            1, 10, 2, true
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, venta_id: 50 });
    });

    it('should fail if user context is missing', async () => {
        req.user = undefined;
        await SalesController.getInstance().createSale(req as Request, res as Response);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should add item to sale', async () => {
        req.params = { id: '50' };
        req.body = { producto_id: 5, cantidad: 2, precio_unitario: 100 };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesController.getInstance().addItem(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_item_agregar', [
            '50', 5, 2, 100
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });
    it('should create a sale with discount', async () => {
        req.body = { cliente_id: 10, urgente: false, descuento: 500 };
        const mockResult = [{ sp_venta_crear: 55 }];
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesController.getInstance().createSale(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_crear', [
            1, 10, 2, false
        ]);
        expect(PostgresDB.getInstance().executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE ventas SET descuento'),
            [500, 55]
        );
        expect(res.json).toHaveBeenCalledWith({ success: true, venta_id: 55 });
    });
});

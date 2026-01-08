import { SalesItemsController } from '../../controllers/sales_items.controller';
import { PostgresDB } from '../../database/postgres';
import { Request, Response } from 'express';

// Mock PostgresDB
jest.mock('../../database/postgres', () => {
    return {
        PostgresDB: {
            getInstance: jest.fn().mockReturnValue({
                callStoredProcedure: jest.fn(),
            }),
        },
    };
});

describe('SalesItemsController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
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
        jest.clearAllMocks();
    });

    it('should create sales item', async () => {
        req.body = { venta_id: 1, producto_id: 1, servicio_id: null, cantidad: 2, precio_unitario: 10, subtotal: 20 };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesItemsController.getInstance().createSalesItem(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_item_crear', [
            1, 1, null, 2, 10, 20
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get items by sale id', async () => {
        req.params = { venta_id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesItemsController.getInstance().getSalesItemsBySaleId(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_item_listar_por_venta', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should update sales item', async () => {
        req.params = { id: '1' };
        req.body = { cantidad: 3, precio_unitario: 10, subtotal: 30 };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesItemsController.getInstance().updateSalesItem(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_item_editar', [
            '1', 3, 10, 30
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should delete sales item', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await SalesItemsController.getInstance().deleteSalesItem(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_venta_item_eliminar', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });
});

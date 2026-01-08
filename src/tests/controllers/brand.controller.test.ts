import { BrandController } from '../../controllers/brand.controller';
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

describe('BrandController', () => {
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

    it('should create a brand', async () => {
        req.body = { nombre: 'Test Brand', proveedor_id: 1 };
        const mockResult = { rows: [{ id: 1, nombre: 'Test Brand' }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await BrandController.getInstance().createBrand(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_marca_crear', ['Test Brand', 1]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should update a brand', async () => {
        req.params = { id: '1' };
        req.body = { nombre: 'Updated Brand', proveedor_id: 2 };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await BrandController.getInstance().updateBrand(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_marca_update', ['1', 'Updated Brand', 2]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get all brands', async () => {
        const mockResult = { rows: [{ id: 1, nombre: 'Brand 1' }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await BrandController.getInstance().getBrands(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_marca_get');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get brand by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [{ id: 1, nombre: 'Brand 1' }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await BrandController.getInstance().getBrandById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_marca_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should delete a brand', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await BrandController.getInstance().deleteBrand(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_marca_delete', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should handle errors', async () => {
        req.body = {};
        const error = new Error('Database error');
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockRejectedValue(error);

        await BrandController.getInstance().createBrand(req as Request, res as Response);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ success: false, error });
    });
});

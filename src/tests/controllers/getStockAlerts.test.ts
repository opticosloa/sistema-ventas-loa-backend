import { getStockAlerts } from '../../controllers/getStockAlerts';
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

describe('getStockAlerts', () => {
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

    it('should get stock alerts', async () => {
        const mockResult = { rows: [{ id: 1, alert: 'Low Stock' }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await getStockAlerts(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_alertas_stock_pendientes');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult.rows });
    });
});

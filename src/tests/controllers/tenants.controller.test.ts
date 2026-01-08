import { TenantsController } from '../../controllers/tenants.controller';
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

describe('TenantsController', () => {
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

    it('should create tenant', async () => {
        req.body = { nombre: 'Branch 1', encargado: 'Manager', direccion: 'Addr', telefono: '123', email: 'b@b.com', is_active: true };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await TenantsController.getInstance().createTenant(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_sucursal_crear', [
            'Branch 1', 'Manager', 'Addr', '123', 'b@b.com', true
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should list tenants', async () => {
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await TenantsController.getInstance().getTenants(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_sucursal_get');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get tenant by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await TenantsController.getInstance().getTenantById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_sucursal_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should update tenant', async () => {
        req.params = { id: '1' };
        req.body = { nombre: 'Updated' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await TenantsController.getInstance().updateTenant(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_sucursal_editar', [
            '1', 'Updated', undefined, undefined, undefined, undefined, undefined
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should delete tenant', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await TenantsController.getInstance().deleteTenant(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_sucursal_eliminar', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });
});

import { ServicesController } from '../../controllers/services.controller';
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

describe('ServicesController', () => {
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

    it('should create service', async () => {
        req.body = { nombre: 'Service 1', descripcion: 'Desc', precio_costo: 10, precio_venta: 20, iva: 21 };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ServicesController.getInstance().createService(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_servicio_crear', [
            'Service 1', 'Desc', 10, 20, 21
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should list services', async () => {
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ServicesController.getInstance().getServices(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_servicio_listar');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get service by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ServicesController.getInstance().getServiceById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_servicio_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should update service', async () => {
        req.params = { id: '1' };
        req.body = { nombre: 'Updated' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ServicesController.getInstance().updateService(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_servicio_editar', [
            '1', 'Updated', undefined, undefined, undefined, undefined
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should delete service', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ServicesController.getInstance().deleteService(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_servicio_eliminar', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });
});

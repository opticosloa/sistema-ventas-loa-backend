import { ClientsController } from '../../controllers/clients.controller';
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

describe('ClientsController', () => {
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

    it('should create a client', async () => {
        req.body = {
            nombre: 'John', apellido: 'Doe', telefono: '123456', email: 'john@example.com',
            dni: '123', direccion: 'Address', fecha_nacimiento: '2000-01-01', cuenta_corriente: 0
        };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ClientsController.getInstance().createClient(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_cliente_crear', [
            'John', 'Doe', '123456', 'john@example.com', '123', 'Address', '2000-01-01', 0
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get clients', async () => {
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ClientsController.getInstance().getClients(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_cliente_listar');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should get client by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ClientsController.getInstance().getClientById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_cliente_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should update a client', async () => {
        req.params = { id: '1' };
        req.body = { nombre: 'John Updated' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ClientsController.getInstance().updateClient(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_cliente_editar', [
            '1', 'John Updated', undefined, undefined, undefined, undefined, undefined, undefined, undefined
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should delete a client', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await ClientsController.getInstance().deleteClient(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_cliente_eliminar', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });
});
